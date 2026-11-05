const express = require('express');
const Customer = require('../models/Customer');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');
const {
  recordCollection,
  recordRefund,
  applyAdvanceToOpenBills,
} = require('../services/billing');

const router = express.Router();
router.use(requireAuth);

router.post('/collect', async (req, res) => {
  try {
    const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    const result = await recordCollection({
      customerId: req.body.customerId,
      paymentDate,
      amounts: req.body.amounts,
      allocationMode: req.body.allocationMode || 'fifo',
      allocations: req.body.allocations || [],
      notes: req.body.notes,
      userId: req.user._id,
    });

    await writeAudit({
      action: 'create',
      entityType: 'Payment',
      entityId: result.payment._id,
      after: result.payment.toObject(),
      performedBy: req.user._id,
    });
    emitChange();
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/refund', async (req, res) => {
  try {
    const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    const result = await recordRefund({
      customerId: req.body.customerId,
      paymentDate,
      amounts: req.body.amounts,
      method: req.body.method || 'cash',
      fromAdvance: req.body.fromAdvance !== false,
      notes: req.body.notes,
      userId: req.user._id,
    });

    await writeAudit({
      action: 'create',
      entityType: 'Payment',
      entityId: result.payment._id,
      after: result.payment.toObject(),
      performedBy: req.user._id,
    });

    emitChange();
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/apply-advance/:customerId', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    await applyAdvanceToOpenBills(customer, req.user._id, new Date());
    emitChange();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
