const express = require('express');
const Customer = require('../models/Customer');
const LedgerEntry = require('../models/LedgerEntry');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const customerId = String(req.query.customerId || '').trim();
  const filter = {};
  const clauses = [];

  if (/^[a-f\d]{24}$/i.test(customerId)) clauses.push({ customerId });

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    const customers = await Customer.find({ $or: [{ name: regex }, { mobile: regex }] }).select('_id');
    const matches = [{ note: regex }, { customerId: { $in: customers.map((customer) => customer._id) } }];
    const amount = Number(q.replace(/[₹,\s]/g, ''));
    if (Number.isFinite(amount) && /\d/.test(q)) {
      matches.push({ debit: amount }, { credit: amount });
    }
    clauses.push({ $or: matches });
  }

  if (clauses.length === 1) Object.assign(filter, clauses[0]);
  if (clauses.length > 1) filter.$and = clauses;

  const entries = await LedgerEntry.find(filter)
    .populate('customerId', 'name mobile')
    .sort({ entryDate: 1, createdAt: 1 })
    .limit(500);

  const customer = /^[a-f\d]{24}$/i.test(customerId)
    ? await Customer.findById(customerId).select('name mobile balance')
    : null;

  res.json({ customer, entries });
});

module.exports = router;
