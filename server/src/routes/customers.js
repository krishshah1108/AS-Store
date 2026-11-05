const express = require('express');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const filter = includeInactive ? {} : { isActive: true };
  const customers = await Customer.find(filter).sort({ name: 1 });
  res.json(customers);
});

router.post(
  '/',
  body('name').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const customer = await Customer.create({
      name: req.body.name.trim(),
      mobile: (req.body.mobile || '').trim(),
      address: (req.body.address || '').trim(),
      notes: (req.body.notes || '').trim(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
      updatedAtClient: req.body.updatedAtClient ? new Date(req.body.updatedAtClient) : new Date(),
    });

    await writeAudit({
      action: 'create',
      entityType: 'Customer',
      entityId: customer._id,
      after: customer.toObject(),
      performedBy: req.user._id,
    });

    emitChange();
    res.status(201).json(customer);
  }
);

router.put('/:id', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const before = customer.toObject();

  if (req.body.name !== undefined) customer.name = String(req.body.name).trim();
  if (req.body.mobile !== undefined) customer.mobile = String(req.body.mobile).trim();
  if (req.body.address !== undefined) customer.address = String(req.body.address).trim();
  if (req.body.notes !== undefined) customer.notes = String(req.body.notes).trim();
  if (req.body.isActive !== undefined) customer.isActive = Boolean(req.body.isActive);
  customer.updatedBy = req.user._id;
  customer.updatedAtClient = req.body.updatedAtClient ? new Date(req.body.updatedAtClient) : new Date();

  await customer.save();

  await writeAudit({
    action: 'update',
    entityType: 'Customer',
    entityId: customer._id,
    before,
    after: customer.toObject(),
    performedBy: req.user._id,
  });

  emitChange();
  res.json(customer);
});

module.exports = router;
