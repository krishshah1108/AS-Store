const Customer = require('../models/Customer');
const LedgerEntry = require('../models/LedgerEntry');

async function getLedger(req, res) {
  const customerId = String(req.query.customerId || '').trim();
  if (!/^[a-f\d]{24}$/i.test(customerId)) {
    return res.json({ customer: null, entries: [] });
  }

  const customer = await Customer.findById(customerId).select('name mobile balance');
  if (!customer) return res.json({ customer: null, entries: [] });

  const entries = await LedgerEntry.find({ customerId })
    .sort({ entryDate: 1, createdAt: 1 })
    .limit(500);

  res.json({ customer, entries });
}

module.exports = { getLedger };
