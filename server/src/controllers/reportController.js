const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Settings = require('../models/Settings');
const { round2 } = require('../services/billing');

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
    kind: 'collection',
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

  for (const payment of payments) {
    const staffId = String(payment.createdBy?._id || payment.createdBy || 'unknown');
    const staffName = payment.createdBy?.name || 'Unknown';
    const s = staffMap.get(staffId) || { userId: staffId, name: staffName, bills: 0, sales: 0, collections: 0 };

    cashCollected = round2(cashCollected + (payment.amounts?.cash || 0));
    upiCollected = round2(upiCollected + (payment.amounts?.upi || 0));
    creditRecovered = round2(creditRecovered + (payment.totalAmount || 0));
    s.collections = round2(s.collections + (payment.totalAmount || 0));
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
    netCash: cashCollected,
    netUpi: upiCollected,
    outstandingTotal: round2(outstandingAgg[0]?.outstandingTotal || 0),
    advanceTotal: round2(outstandingAgg[0]?.advanceTotal || 0),
    products: [...productMap.values()].sort((a, b) => b.amount - a.amount),
    staff: [...staffMap.values()].sort((a, b) => b.sales - a.sales),
  };
}

function dayKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

async function salesTrend(days = 7) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const bills = await Bill.find({
    billDate: { $gte: start, $lte: end },
    status: { $in: ['final', 'returned'] },
  }).select('billDate total');

  const totals = new Map();
  for (const bill of bills) {
    const key = dayKey(bill.billDate);
    totals.set(key, round2((totals.get(key) || 0) + bill.total));
  }

  const trend = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = dayKey(date);
    trend.push({
      date: key,
      label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      sales: totals.get(key) || 0,
    });
  }
  return trend;
}

async function getDashboard(req, res) {
  const { start, end } = rangeBounds();
  const summary = await summarizePeriod(start, end);
  const trend = await salesTrend(7);
  const recentBills = await Bill.find({
    billDate: { $gte: start, $lte: end },
    status: { $in: ['final', 'returned'] },
  })
    .populate('customerId', 'name')
    .sort({ createdAt: -1 })
    .limit(8)
    .select('billNo customerId total dueAmount');

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
    trend,
    recentBills,
  });
}

async function getSummary(req, res) {
  const { start, end } = rangeBounds(req.query.from, req.query.to);
  const summary = await summarizePeriod(start, end);
  res.json(summary);
}

async function getCustomers(req, res) {
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
}

module.exports = {
  getDashboard,
  getSummary,
  getCustomers,
};
