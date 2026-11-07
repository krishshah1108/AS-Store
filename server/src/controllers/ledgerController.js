const Customer = require('../models/Customer');
const LedgerEntry = require('../models/LedgerEntry');

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

async function getLedger(req, res) {
  try {
    const customerId = String(req.query.customerId || '').trim();
    if (!/^[a-f\d]{24}$/i.test(customerId)) {
      return res.json({
        customer: null,
        entries: [],
        totals: { debit: 0, credit: 0 },
        outstanding: 0,
      });
    }

    const customer = await Customer.findById(customerId).select('name mobile balance');
    if (!customer) {
      return res.json({
        customer: null,
        entries: [],
        totals: { debit: 0, credit: 0 },
        outstanding: 0,
      });
    }

    const docs = await LedgerEntry.find({ customerId })
      .sort({ entryDate: 1, createdAt: 1 })
      .limit(500)
      .lean();

    let debitTotal = 0;
    let creditTotal = 0;
    const entries = docs.map((entry) => {
      const debit = round2(entry.debit || 0);
      const credit = round2(entry.credit || 0);
      debitTotal = round2(debitTotal + debit);
      creditTotal = round2(creditTotal + credit);
      return {
        ...entry,
        debit,
        credit,
        running: round2(entry.balanceAfter),
      };
    });

    return res.json({
      customer,
      entries,
      totals: { debit: debitTotal, credit: creditTotal },
      outstanding: round2(customer.balance || 0),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Could not load ledger' });
  }
}

module.exports = { getLedger };
