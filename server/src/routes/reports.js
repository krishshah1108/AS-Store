const express = require('express');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { round2 } = require('../services/billing');

const router = express.Router();
router.use(requireAuth);

function rangeBounds(from, to) {
  const start = from ? new Date(from) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function summarizePeriod(start, end) {
  const bills = await Bill.find({
    billDate: { $gte: start, $lte: end },
    status: { $in: ['final', 'returned'] },
  }).populate('createdBy', 'name');

  const payments = await Payment.find({
    paymentDate: { $gte: start, $lte: end },
  }).populate('createdBy', 'name');

  let salesTotal = 0;
  let billCount = 0;
  let creditGiven = 0;
  let cashOnBills = 0;
  let upiOnBills = 0;
  const productMap = new Map();
  const staffMap = new Map();

  for (const bill of bills) {
    billCount += 1;
    salesTotal = round2(salesTotal + bill.total);
    creditGiven = round2(creditGiven + (bill.payments?.credit || 0));
    cashOnBills = round2(cashOnBills + (bill.payments?.cash || 0));
    upiOnBills = round2(upiOnBills + (bill.payments?.upi || 0));

    for (const item of bill.items || []) {
      const key = item.name || 'Item';
      const prev = productMap.get(key) || { name: key, qty: 0, amount: 0 };
      prev.qty = round2(prev.qty + item.qty);
      prev.amount = round2(prev.amount + item.amount);
      productMap.set(key, prev);
    }

    const staffId = String(bill.createdBy?._id || bill.createdBy || 'unknown');
    const staffName = bill.createdBy?.name || 'Unknown';
    const s = staffMap.get(staffId) || { userId: staffId, name: staffName, bills: 0, sales: 0, collections: 0 };
    s.bills += 1;
    s.sales = round2(s.sales + bill.total);
    staffMap.set(staffId, s);
  }

  let cashCollected = cashOnBills;
  let upiCollected = upiOnBills;
  let creditRecovered = 0;
  let refundsCash = 0;
  let refundsUpi = 0;

  for (const p of payments) {
    const staffId = String(p.createdBy?._id || p.createdBy || 'unknown');
    const staffName = p.createdBy?.name || 'Unknown';
    const s = staffMap.get(staffId) || { userId: staffId, name: staffName, bills: 0, sales: 0, collections: 0 };

    if (p.kind === 'collection') {
      cashCollected = round2(cashCollected + (p.amounts?.cash || 0));
      upiCollected = round2(upiCollected + (p.amounts?.upi || 0));
      const recovered = round2(p.totalAmount - Math.max(0, p.advanceDelta || 0));
      creditRecovered = round2(creditRecovered + recovered);
      s.collections = round2(s.collections + p.totalAmount);
    } else if (p.kind === 'refund' && p.method !== 'credit_adjustment') {
      refundsCash = round2(refundsCash + (p.amounts?.cash || 0));
      refundsUpi = round2(refundsUpi + (p.amounts?.upi || 0));
    }
    staffMap.set(staffId, s);
  }

  const outstandingAgg = await Customer.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        outstandingTotal: { $sum: '$balance' },
        advanceTotal: { $sum: '$advanceBalance' },
      },
    },
  ]);

  return {
    salesTotal,
    billCount,
    cashCollected,
    upiCollected,
    creditGiven,
    creditRecovered,
    netCash: round2(cashCollected - refundsCash),
    netUpi: round2(upiCollected - refundsUpi),
    outstandingTotal: round2(outstandingAgg[0]?.outstandingTotal || 0),
    advanceTotal: round2(outstandingAgg[0]?.advanceTotal || 0),
    products: [...productMap.values()].sort((a, b) => b.amount - a.amount),
    staff: [...staffMap.values()].sort((a, b) => b.sales - a.sales),
  };
}

router.get('/dashboard', async (req, res) => {
  const { start, end } = rangeBounds();
  const summary = await summarizePeriod(start, end);

  const settings = await Settings.findOne();
  const overdueDays = settings?.overdueDays || 30;
  const overdueBefore = new Date();
  overdueBefore.setDate(overdueBefore.getDate() - overdueDays);
  overdueBefore.setHours(23, 59, 59, 999);

  const overdueBills = await Bill.find({
    status: 'final',
    dueAmount: { $gt: 0 },
    billDate: { $lte: overdueBefore },
  })
    .populate('customerId', 'name')
    .sort({ billDate: 1 })
    .limit(50);

  const pendingCustomers = await Customer.find({ isActive: true, balance: { $gt: 0 } })
    .select('name balance')
    .sort({ balance: -1 })
    .limit(50);

  res.json({
    ...summary,
    overdueDays,
    overdueBills,
    pendingCustomers,
  });
});

router.get('/summary', async (req, res) => {
  const { start, end } = rangeBounds(req.query.from, req.query.to);
  const summary = await summarizePeriod(start, end);
  res.json(summary);
});

router.get('/customers', async (req, res) => {
  const { start, end } = rangeBounds(req.query.from, req.query.to);
  const bills = await Bill.find({
    billDate: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' },
  });

  const map = new Map();
  for (const bill of bills) {
    const id = String(bill.customerId);
    const row = map.get(id) || { customerId: id, sales: 0, credit: 0, bills: 0 };
    row.sales = round2(row.sales + bill.total);
    row.credit = round2(row.credit + (bill.payments?.credit || 0));
    row.bills += 1;
    map.set(id, row);
  }

  const customers = await Customer.find({ _id: { $in: [...map.keys()] } }).select(
    'name mobile balance advanceBalance'
  );
  const byId = Object.fromEntries(customers.map((c) => [String(c._id), c]));

  const rows = [...map.values()]
    .map((r) => ({
      ...r,
      customer: byId[r.customerId] || null,
    }))
    .sort((a, b) => b.sales - a.sales);

  res.json(rows);
});

module.exports = router;
