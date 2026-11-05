const express = require('express');
const Customer = require('../models/Customer');
const LedgerEntry = require('../models/LedgerEntry');
const Bill = require('../models/Bill');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/customer/:customerId', async (req, res) => {
  const customer = await Customer.findById(req.params.customerId);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const entries = await LedgerEntry.find({ customerId: customer._id })
    .sort({ entryDate: 1, createdAt: 1 })
    .limit(500);

  const openBills = await Bill.find({
    customerId: customer._id,
    status: 'final',
    dueAmount: { $gt: 0 },
  })
    .select('billNo billDate total paidAmount dueAmount')
    .sort({ billDate: 1 });

  res.json({
    customer,
    entries,
    openBills,
  });
});

module.exports = router;
