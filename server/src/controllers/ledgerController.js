const Customer = require('../models/Customer');
const LedgerEntry = require('../models/LedgerEntry');

async function getLedger(req, res) {
  try {
    const customerId = String(req.query.customerId || '').trim();
    if (!/^[a-f\d]{24}$/i.test(customerId)) {
      return res.json({ customer: null, entries: [] });
    }

    const customer = await Customer.findById(customerId).select('name mobile balance');
    if (!customer) return res.json({ customer: null, entries: [] });

    const entries = await LedgerEntry.find({ customerId })
      .sort({ entryDate: 1, createdAt: 1 })
      .limit(500);

    return res.json({ customer, entries });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Could not load ledger' });
  }
}

module.exports = { getLedger };
