const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const LedgerEntry = require('../models/LedgerEntry');
const Payment = require('../models/Payment');
const { moneyError } = require('../lib/validate');
const { writeAudit } = require('../utils/audit');
const { billChanges } = require('./billAudit');

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function normalizeItems(items = []) {
  return items.map((item) => {
    const rateProblem = moneyError(item.rate, 'Rate');
    if (rateProblem) throw new Error(rateProblem);
    const qty = round2(item.qty);
    const rate = round2(item.rate);
    if (!(qty > 0)) throw new Error('Each item needs a qty greater than 0');
    return {
      productId: item.productId || undefined,
      name: String(item.name || '').trim(),
      qty,
      rate,
      amount: round2(qty * rate),
    };
  });
}

function computeTotals(items, discount = 0) {
  const discountProblem = moneyError(discount, 'Discount');
  if (discountProblem) throw new Error(discountProblem);
  const normalized = normalizeItems(items);
  const subtotal = round2(normalized.reduce((sum, i) => sum + i.amount, 0));
  const disc = round2(discount || 0);
  if (disc > subtotal) {
    throw new Error('Discount cannot exceed subtotal');
  }
  const total = round2(subtotal - disc);
  return { items: normalized, subtotal, discount: disc, total };
}

function normalizePayments(payments = {}, total) {
  const cashProblem = moneyError(payments.cash, 'Cash');
  const upiProblem = moneyError(payments.upi, 'UPI');
  const creditProblem =
    payments.credit === undefined || payments.credit === null || payments.credit === ''
      ? ''
      : moneyError(payments.credit, 'Credit');
  if (cashProblem || upiProblem || creditProblem) {
    throw new Error(cashProblem || upiProblem || creditProblem);
  }
  const cash = round2(payments.cash || 0);
  const upi = round2(payments.upi || 0);
  let credit = round2(payments.credit || 0);

  const paidNow = round2(cash + upi);
  if (paidNow > total) {
    throw new Error('Cash + UPI cannot exceed bill total');
  }

  const remainder = round2(total - paidNow);
  if (payments.credit === undefined || payments.credit === null || payments.credit === '') {
    credit = remainder;
  } else if (round2(cash + upi + credit) !== total) {
    throw new Error('Cash + UPI + Credit must equal bill total');
  }

  return {
    payments: { cash, upi, credit },
    paidAmount: paidNow,
    dueAmount: credit,
  };
}

async function nextSeq(prefix) {
  const year = new Date().getFullYear();
  const key = `${prefix}_${year}`;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return { year, seq: counter.seq };
}

async function nextBillNo() {
  const { year, seq } = await nextSeq('bill');
  return `AS-${year}-${String(seq).padStart(4, '0')}`;
}

async function nextPaymentNo() {
  const { year, seq } = await nextSeq('payment');
  return `ASP-${year}-${String(seq).padStart(4, '0')}`;
}

function billRefs(bill) {
  if (!bill?._id || !bill.billNo) return [];
  return [{ billId: bill._id, billNo: bill.billNo }];
}

async function allocationRefs(allocations) {
  const ids = [];
  for (const row of allocations || []) {
    const id = row?.billId;
    if (id && !ids.some((item) => String(item) === String(id))) ids.push(id);
  }
  if (!ids.length) return [];
  const found = await Bill.find({ _id: { $in: ids } }).select('billNo').lean();
  const numbers = new Map(found.map((bill) => [String(bill._id), bill.billNo]));
  return ids
    .filter((id) => numbers.has(String(id)))
    .map((id) => ({ billId: id, billNo: numbers.get(String(id)) }));
}

async function postLedger({ customerId, type, debit = 0, credit = 0, refType, refId, bills = [], note, entryDate, userId }) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error('Customer not found');

  const nextBalance = round2((customer.balance || 0) + debit - credit);
  customer.balance = nextBalance;
  await customer.save();

  return LedgerEntry.create({
    customerId,
    type,
    debit: round2(debit),
    credit: round2(credit),
    balanceAfter: nextBalance,
    refType,
    refId,
    bills,
    note,
    entryDate,
    createdBy: userId,
  });
}

function atBillPaid(bill) {
  return round2((Number(bill.payments?.cash) || 0) + (Number(bill.payments?.upi) || 0));
}

function settleBillAmounts(total, atBillPaidAmount, laterCollected) {
  const billTotal = round2(total);
  const atBill = round2(atBillPaidAmount);
  const later = round2(laterCollected);
  if (atBill < -0.001 || later < -0.001) throw new Error('Payment cannot be negative');
  if (round2(atBill + later) > billTotal + 0.009) {
    throw new Error('Bill total cannot be less than the amount already received');
  }
  const paidAmount = round2(atBill + later);
  return {
    paymentsCredit: round2(billTotal - atBill),
    paidAmount,
    dueAmount: round2(billTotal - paidAmount),
  };
}

async function reverseBillLedger(bill, userId, note) {
  if (bill.total > 0) {
    await postLedger({
      customerId: bill.customerId,
      type: 'reversal',
      credit: bill.total,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: note || `Reversal of bill ${bill.billNo}`,
      entryDate: bill.billDate,
      userId,
    });
  }
  const originalPaid = atBillPaid(bill);
  if (originalPaid > 0) {
    await postLedger({
      customerId: bill.customerId,
      type: 'reversal',
      debit: originalPaid,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: note || `Reversal of payment on ${bill.billNo}`,
      entryDate: bill.billDate,
      userId,
    });
  }
}

async function applyBillLedger(bill, userId) {
  if (bill.total > 0) {
    await postLedger({
      customerId: bill.customerId,
      type: 'bill',
      debit: bill.total,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: `Bill ${bill.billNo}`,
      entryDate: bill.billDate,
      userId,
    });
  }

  const originalPaid = atBillPaid(bill);
  if (originalPaid > 0) {
    await postLedger({
      customerId: bill.customerId,
      type: 'payment',
      credit: originalPaid,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: `Payment on ${bill.billNo} (cash ${bill.payments.cash} / UPI ${bill.payments.upi})`,
      entryDate: bill.billDate,
      userId,
    });
  }
}

function snapshotBill(bill) {
  const obj = typeof bill.toObject === 'function' ? bill.toObject() : { ...bill };
  delete obj.revisions;
  return obj;
}

async function openBillsForCustomer(customerId) {
  return Bill.find({
    customerId,
    status: 'final',
    dueAmount: { $gt: 0 },
  }).sort({ billDate: 1, createdAt: 1 });
}

function fifoAllocate(openBills, amount) {
  let remaining = round2(amount);
  const allocations = [];
  for (const bill of openBills) {
    if (remaining <= 0) break;
    const apply = round2(Math.min(bill.dueAmount, remaining));
    if (apply <= 0) continue;
    allocations.push({ billId: bill._id, amount: apply });
    remaining = round2(remaining - apply);
  }
  return { allocations, leftover: remaining };
}

async function applyAllocationsToBills(allocations, userId) {
  for (const row of allocations) {
    const bill = await Bill.findById(row.billId);
    if (!bill || bill.status !== 'final') {
      throw new Error('Allocation target bill is missing or not open');
    }
    const amount = round2(row.amount);
    if (amount <= 0) continue;
    if (amount > bill.dueAmount + 0.001) {
      throw new Error(`Allocation ₹${amount} exceeds due ₹${bill.dueAmount} on ${bill.billNo}`);
    }
    const before = snapshotBill(bill);
    bill.dueAmount = round2(bill.dueAmount - amount);
    bill.paidAmount = round2(bill.paidAmount + amount);
    bill.updatedBy = userId;
    await bill.save();
    const after = snapshotBill(bill);
    await writeAudit({
      action: 'collect',
      entityType: 'Bill',
      entityId: bill._id,
      before,
      after,
      changes: billChanges(before, after),
      summary: `Recorded ₹${amount.toFixed(2)} against this bill`,
      performedBy: userId,
    });
  }
}

async function applyAdvanceToOpenBills(customer, userId, entryDate) {
  const advance = round2(customer.advanceBalance || 0);
  if (advance <= 0) return { applied: 0, allocations: [] };

  const openBills = await openBillsForCustomer(customer._id);
  if (!openBills.length) return { applied: 0, allocations: [] };

  const { allocations, leftover } = fifoAllocate(openBills, advance);
  const applied = round2(advance - leftover);
  if (applied <= 0) return { applied: 0, allocations: [] };

  await applyAllocationsToBills(allocations, userId);
  customer.advanceBalance = leftover;
  await customer.save();

  await postLedger({
    customerId: customer._id,
    type: 'advance',
    credit: applied,
    refType: 'Customer',
    refId: customer._id,
    bills: await allocationRefs(allocations),
    note: `Advance applied to bills (FIFO) ₹${applied}`,
    entryDate: entryDate || new Date(),
    userId,
  });

  return { applied, allocations };
}

/**
 * Record a collection against customer dues (FIFO or manual), with surplus → advance.
 */
async function recordCollection({
  customerId,
  paymentDate,
  amounts,
  allocationMode = 'fifo',
  allocations: manualAllocations = [],
  notes = '',
  userId,
}) {
  const customer = await Customer.findById(customerId);
  if (!customer || !customer.isActive) throw new Error('Valid active customer required');

  const cashProblem = moneyError(amounts?.cash, 'Cash');
  const upiProblem = moneyError(amounts?.upi, 'UPI');
  if (cashProblem || upiProblem) throw new Error(cashProblem || upiProblem);
  const cash = round2(amounts?.cash || 0);
  const upi = round2(amounts?.upi || 0);
  const totalAmount = round2(cash + upi);
  if (totalAmount <= 0) throw new Error('Enter a cash or UPI amount');

  const openBills = await openBillsForCustomer(customerId);
  let allocations = [];
  let leftover = totalAmount;

  if (allocationMode === 'manual') {
    allocations = (manualAllocations || []).map((a) => ({
      billId: a.billId,
      amount: round2(a.amount),
    }));
    const allocSum = round2(allocations.reduce((s, a) => s + a.amount, 0));
    if (allocSum > totalAmount + 0.001) {
      throw new Error('Manual allocations exceed payment amount');
    }
    for (const row of allocations) {
      if (row.amount < 0) throw new Error('Allocation cannot be negative');
      const bill = openBills.find((b) => String(b._id) === String(row.billId));
      if (!bill) throw new Error('Manual allocation references a bill that is not open');
      if (row.amount > bill.dueAmount + 0.001) {
        throw new Error(`Allocation exceeds due on bill ${bill.billNo}`);
      }
    }
    leftover = round2(totalAmount - allocSum);
  } else if (allocationMode === 'fifo') {
    const result = fifoAllocate(openBills, totalAmount);
    allocations = result.allocations;
    leftover = result.leftover;
  } else {
    leftover = totalAmount;
    allocations = [];
  }

  const appliedToDues = round2(totalAmount - leftover);
  await applyAllocationsToBills(allocations, userId);

  let advanceDelta = 0;
  if (leftover > 0) {
    customer.advanceBalance = round2((customer.advanceBalance || 0) + leftover);
    advanceDelta = leftover;
    await customer.save();
  }

  const paymentNo = await nextPaymentNo();
  const method = cash > 0 && upi > 0 ? 'mixed' : upi > 0 ? 'upi' : 'cash';

  const payment = await Payment.create({
    paymentNo,
    customerId,
    paymentDate,
    kind: 'collection',
    method,
    amounts: { cash, upi },
    totalAmount,
    allocationMode,
    allocations,
    advanceDelta,
    notes: String(notes || '').trim(),
    createdBy: userId,
  });

  if (appliedToDues > 0) {
    await postLedger({
      customerId,
      type: 'payment',
      credit: appliedToDues,
      refType: 'Payment',
      refId: payment._id,
      bills: await allocationRefs(allocations),
      note: `Collection ${payment.paymentNo} (cash ${cash} / UPI ${upi})`,
      entryDate: paymentDate,
      userId,
    });
  }

  if (advanceDelta > 0) {
    await LedgerEntry.create({
      customerId,
      type: 'advance',
      debit: 0,
      credit: 0,
      balanceAfter: (await Customer.findById(customerId)).balance,
      refType: 'Payment',
      refId: payment._id,
      note: `Advance deposited ₹${advanceDelta} via ${payment.paymentNo}`,
      entryDate: paymentDate,
      createdBy: userId,
    });
  }

  return { payment };
}

/**
 * Refund cash/UPI from advance, or credit adjustment (reduce receivable without payout).
 */
async function recordRefund({
  customerId,
  paymentDate,
  amounts,
  method = 'cash',
  fromAdvance = true,
  notes = '',
  userId,
}) {
  const customer = await Customer.findById(customerId);
  if (!customer || !customer.isActive) throw new Error('Valid active customer required');

  if (method === 'credit_adjustment') {
    const problem = moneyError(amounts?.amount, 'Amount', { required: true, min: 0.01 });
    if (problem) throw new Error(problem === 'Enter Amount' ? 'Refund amount must be greater than 0' : problem);
  } else {
    const cashProblem = moneyError(amounts?.cash, 'Cash');
    const upiProblem = moneyError(amounts?.upi, 'UPI');
    if (cashProblem || upiProblem) throw new Error(cashProblem || upiProblem);
  }
  const cash = round2(amounts?.cash || 0);
  const upi = round2(amounts?.upi || 0);
  const totalAmount =
    method === 'credit_adjustment' ? round2(amounts?.amount || 0) : round2(cash + upi);

  if (totalAmount <= 0) throw new Error('Refund amount must be greater than 0');

  if (method === 'credit_adjustment' && totalAmount > (customer.balance || 0) + 0.001) {
    throw new Error('Credit adjustment cannot exceed outstanding balance');
  }
  if (method !== 'credit_adjustment' && fromAdvance && totalAmount > (customer.advanceBalance || 0) + 0.001) {
    throw new Error('Refund exceeds advance balance');
  }

  const paymentNo = await nextPaymentNo();
  let advanceDelta = 0;

  const payment = await Payment.create({
    paymentNo,
    customerId,
    paymentDate,
    kind: 'refund',
    method:
      method === 'credit_adjustment'
        ? 'credit_adjustment'
        : cash > 0 && upi > 0
          ? 'mixed'
          : upi > 0
            ? 'upi'
            : 'cash',
    amounts: {
      cash: method === 'credit_adjustment' ? 0 : cash,
      upi: method === 'credit_adjustment' ? 0 : upi,
    },
    totalAmount,
    allocationMode: 'none',
    allocations: [],
    advanceDelta: 0,
    notes: String(notes || '').trim(),
    createdBy: userId,
  });

  if (method === 'credit_adjustment') {
    await postLedger({
      customerId,
      type: 'refund',
      credit: totalAmount,
      refType: 'Payment',
      refId: payment._id,
      note: notes || `Credit adjustment ${payment.paymentNo}`,
      entryDate: paymentDate,
      userId,
    });
  } else if (fromAdvance) {
    customer.advanceBalance = round2((customer.advanceBalance || 0) - totalAmount);
    advanceDelta = -totalAmount;
    payment.advanceDelta = advanceDelta;
    await customer.save();
    await payment.save();
    await LedgerEntry.create({
      customerId,
      type: 'refund',
      debit: 0,
      credit: 0,
      balanceAfter: customer.balance,
      refType: 'Payment',
      refId: payment._id,
      note: notes || `Advance refund ${payment.paymentNo} cash ${cash} / UPI ${upi}`,
      entryDate: paymentDate,
      createdBy: userId,
    });
  } else {
    await postLedger({
      customerId,
      type: 'refund',
      debit: totalAmount,
      refType: 'Payment',
      refId: payment._id,
      note: notes || `Refund ${payment.paymentNo} cash ${cash} / UPI ${upi}`,
      entryDate: paymentDate,
      userId,
    });
  }

  return { payment };
}

async function cancelBill(billId, userId, reason = '') {
  const bill = await Bill.findById(billId);
  if (!bill) throw new Error('Bill not found');
  if (bill.status === 'cancelled') throw new Error('Bill already cancelled');
  if (bill.status === 'returned') {
    throw new Error('Returned bills cannot be cancelled — use refunds if needed');
  }

  const before = snapshotBill(bill);
  const laterCollected = round2(
    Math.max(0, bill.paidAmount - round2((bill.payments?.cash || 0) + (bill.payments?.upi || 0)))
  );

  // Reverse original bill posting using original total and original at-bill paid
  const originalPaid = round2((bill.payments?.cash || 0) + (bill.payments?.upi || 0));
  if (bill.total > 0) {
    await postLedger({
      customerId: bill.customerId,
      type: 'reversal',
      credit: bill.total,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: `Cancel bill ${bill.billNo}`,
      entryDate: new Date(),
      userId,
    });
  }
  if (originalPaid > 0) {
    await postLedger({
      customerId: bill.customerId,
      type: 'reversal',
      debit: originalPaid,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: `Cancel bill payment reverse ${bill.billNo}`,
      entryDate: new Date(),
      userId,
    });
  }

  // Later collections against this bill already credited balance; after reversing the bill
  // those credits would over-credit. Move laterCollected into advance instead of leaving
  // a negative balance effect: debit balance back then add advance.
  if (laterCollected > 0) {
    await postLedger({
      customerId: bill.customerId,
      type: 'reversal',
      debit: laterCollected,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: `Reclass collection on cancelled ${bill.billNo} to advance`,
      entryDate: new Date(),
      userId,
    });
    const customer = await Customer.findById(bill.customerId);
    customer.advanceBalance = round2((customer.advanceBalance || 0) + laterCollected);
    await customer.save();
  }

  bill.status = 'cancelled';
  bill.dueAmount = 0;
  bill.cancelReason = String(reason || '').trim();
  bill.updatedBy = userId;
  bill.revisions.push({
    at: new Date(),
    by: userId,
    reason: bill.cancelReason || 'Bill cancelled',
    before,
    after: null,
  });
  await bill.save();
  const after = snapshotBill(bill);
  bill.revisions[bill.revisions.length - 1].after = after;
  await bill.save();

  return bill;
}

async function deleteBill(billId, userId) {
  const bill = await Bill.findById(billId);
  if (!bill) throw new Error('Bill not found');
  const before = snapshotBill(bill);
  if (bill.status === 'final') {
    await cancelBill(billId, userId, 'Deleted');
  }
  await Bill.deleteOne({ _id: billId });
  return before;
}

/**
 * Partial or full product return: reduce bill items/totals and credit customer ledger.
 * Any surplus beyond outstanding balance is moved to advance (cash/UPI refund via Payments).
 */
async function returnBillItems(billId, { items: returnItems, notes = '' }, userId) {
  const bill = await Bill.findById(billId);
  if (!bill) throw new Error('Bill not found');
  if (bill.status !== 'final') throw new Error('Only final bills can accept returns');

  const before = snapshotBill(bill);
  const currentItems = bill.items.map((i) => ({ ...(typeof i.toObject === 'function' ? i.toObject() : i) }));

  for (const ret of returnItems || []) {
    const idx = Number.isInteger(ret.index)
      ? ret.index
      : currentItems.findIndex(
          (i) =>
            (ret.productId && String(i.productId || '') === String(ret.productId)) ||
            (ret.name && i.name === ret.name && Number(i.rate) === Number(ret.rate))
        );
    if (idx < 0 || !currentItems[idx]) {
      throw new Error(`Return item not found on bill: ${ret.name || ret.productId}`);
    }
    const qty = round2(ret.qty);
    if (qty <= 0) throw new Error('Return qty must be > 0');
    if (qty > currentItems[idx].qty + 0.001) {
      throw new Error(`Cannot return more than billed qty for ${currentItems[idx].name}`);
    }
    currentItems[idx].qty = round2(currentItems[idx].qty - qty);
    currentItems[idx].amount = round2(currentItems[idx].qty * currentItems[idx].rate);
  }

  const remainingItems = currentItems.filter((i) => i.qty > 0);
  const oldTotal = bill.total;
  let subtotal = 0;
  let discount = 0;
  let total = 0;
  let items = [];

  if (remainingItems.length) {
    const computed = computeTotals(remainingItems, Math.min(bill.discount, bill.subtotal));
    // Scale discount proportionally if subtotal shrinks
    const ratio = bill.subtotal > 0 ? computed.subtotal / bill.subtotal : 0;
    discount = round2(Math.min(bill.discount * ratio, computed.subtotal));
    const recomputed = computeTotals(remainingItems, discount);
    items = recomputed.items;
    subtotal = recomputed.subtotal;
    total = recomputed.total;
  }

  const returnValue = round2(oldTotal - total);
  if (returnValue <= 0) throw new Error('Nothing to return');

  const dueReduce = round2(Math.min(bill.dueAmount, returnValue));

  if (!remainingItems.length) {
    bill.items = before.items.map((i) => ({ ...i, qty: 0, amount: 0 }));
    bill.status = 'returned';
    bill.subtotal = 0;
    bill.discount = 0;
    bill.total = 0;
    bill.dueAmount = 0;
    bill.payments.credit = 0;
  } else {
    bill.items = items;
    bill.subtotal = subtotal;
    bill.discount = discount;
    bill.total = total;
    bill.dueAmount = round2(bill.dueAmount - dueReduce);
    bill.payments.credit = bill.dueAmount;
  }

  bill.returnNote = String(notes || '').trim();
  bill.updatedBy = userId;

  await postLedger({
    customerId: bill.customerId,
    type: 'return',
    credit: returnValue,
    refType: 'Bill',
    refId: bill._id,
    bills: billRefs(bill),
    note: notes || `Return on ${bill.billNo} ₹${returnValue}`,
    entryDate: new Date(),
    userId,
  });

  const customer = await Customer.findById(bill.customerId);
  if (customer.balance < 0) {
    const adv = round2(Math.abs(customer.balance));
    customer.balance = 0;
    customer.advanceBalance = round2((customer.advanceBalance || 0) + adv);
    await customer.save();
    await LedgerEntry.create({
      customerId: customer._id,
      type: 'advance',
      debit: 0,
      credit: 0,
      balanceAfter: 0,
      refType: 'Bill',
      refId: bill._id,
      bills: billRefs(bill),
      note: `Return surplus ₹${adv} moved to advance`,
      entryDate: new Date(),
      createdBy: userId,
    });
  }

  bill.revisions.push({
    at: new Date(),
    by: userId,
    reason: notes || 'Product return',
    before,
    after: null,
  });
  await bill.save();
  bill.revisions[bill.revisions.length - 1].after = snapshotBill(bill);
  await bill.save();

  return { bill, before };
}

async function laterCollectedForBill(billId) {
  const rows = await Payment.find({ kind: 'collection', 'allocations.billId': billId }).select('allocations');
  let sum = 0;
  for (const row of rows) {
    for (const allocation of row.allocations) {
      if (String(allocation.billId) === String(billId)) sum += Number(allocation.amount) || 0;
    }
  }
  return round2(sum);
}

async function listBillPayments(bill) {
  const rows = await Payment.find({ kind: 'collection', 'allocations.billId': bill._id }).sort({
    paymentDate: 1,
    createdAt: 1,
  });
  const payments = [];
  const atBill = atBillPaid(bill);
  if (atBill > 0) {
    payments.push({
      id: `bill-${bill._id}`,
      kind: 'billing',
      paymentNo: bill.billNo,
      paymentDate: bill.billDate,
      totalAmount: atBill,
      notes: 'Received with the bill',
    });
  }
  for (const row of rows) {
    const allocated = row.allocations.find((item) => String(item.billId) === String(bill._id));
    payments.push({
      id: String(row._id),
      kind: 'payment',
      paymentNo: row.paymentNo,
      paymentDate: row.paymentDate,
      totalAmount: round2(allocated?.amount || 0),
      notes: row.notes || '',
    });
  }
  return payments;
}

async function receiveBillPayment(billId, { paymentDate, amounts, notes }, userId) {
  const bill = await Bill.findById(billId);
  if (!bill) throw new Error('Bill not found');
  if (bill.status !== 'final') throw new Error('Only an open bill can take a payment');

  const cashProblem = moneyError(amounts?.cash, 'Cash');
  const upiProblem = moneyError(amounts?.upi, 'UPI');
  if (cashProblem || upiProblem) throw new Error(cashProblem || upiProblem);
  const cash = round2(amounts?.cash || 0);
  const upi = round2(amounts?.upi || 0);
  const amount = round2(cash + upi);
  if (amount <= 0) throw new Error('Enter a cash or UPI amount');
  if (amount > round2(bill.dueAmount) + 0.001) {
    throw new Error('Payment is more than the pending amount');
  }

  const before = snapshotBill(bill);
  const billTotal = bill.total;
  const originalCash = round2(bill.payments?.cash || 0);
  const originalUpi = round2(bill.payments?.upi || 0);
  const originalCredit = round2(bill.payments?.credit || 0);

  bill.paidAmount = round2(bill.paidAmount + amount);
  bill.dueAmount = round2(bill.dueAmount - amount);
  bill.payments.cash = originalCash;
  bill.payments.upi = originalUpi;
  bill.payments.credit = originalCredit;
  bill.total = billTotal;
  bill.updatedBy = userId;
  await bill.save();

  const paymentNo = await nextPaymentNo();
  const method = cash > 0 && upi > 0 ? 'mixed' : upi > 0 ? 'upi' : 'cash';
  const payment = await Payment.create({
    paymentNo,
    customerId: bill.customerId,
    paymentDate: paymentDate || new Date(),
    kind: 'collection',
    method,
    amounts: { cash, upi },
    totalAmount: amount,
    allocationMode: 'manual',
    allocations: [{ billId: bill._id, amount }],
    advanceDelta: 0,
    notes: String(notes || '').trim(),
    createdBy: userId,
  });

  await postLedger({
    customerId: bill.customerId,
    type: 'payment',
    credit: amount,
    refType: 'Payment',
    refId: payment._id,
    bills: billRefs(bill),
    note: notes || `Payment ${paymentNo} on ${bill.billNo}`,
    entryDate: payment.paymentDate,
    userId,
  });

  const after = snapshotBill(bill);
  await writeAudit({
    action: 'collect',
    entityType: 'Bill',
    entityId: bill._id,
    before,
    after,
    changes: billChanges(before, after).filter((change) => change.field === 'paidAmount' || change.field === 'dueAmount'),
    summary: `Received ₹${amount.toFixed(2)} against this bill`,
    performedBy: userId,
  });

  return { bill, payment };
}

module.exports = {
  round2,
  computeTotals,
  normalizePayments,
  settleBillAmounts,
  atBillPaid,
  nextBillNo,
  reverseBillLedger,
  applyBillLedger,
  snapshotBill,
  applyAdvanceToOpenBills,
  recordCollection,
  recordRefund,
  deleteBill,
  returnBillItems,
  laterCollectedForBill,
  listBillPayments,
  receiveBillPayment,
};
