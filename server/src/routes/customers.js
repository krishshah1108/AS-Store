const express = require('express');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');
const { mobileDigits, mobileError } = require('../lib/validate');

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
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('mobile')
    .optional({ values: 'falsy' })
    .custom((value) => {
      const message = mobileError(value);
      if (message) throw new Error(message);
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const mobile = mobileDigits(req.body.mobile);
    const taken = mobile ? await Customer.findOne({ mobile }) : null;
    if (taken) return res.status(409).json({ message: 'This mobile number is already used' });

    const customer = await Customer.create({
      name: req.body.name.trim(),
      mobile,
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

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'Name is required' });
    customer.name = name;
  }
  if (req.body.mobile !== undefined) {
    const message = mobileError(req.body.mobile);
    if (message) return res.status(400).json({ message });
    const mobile = mobileDigits(req.body.mobile);
    if (mobile) {
      const taken = await Customer.findOne({ mobile, _id: { $ne: customer._id } });
      if (taken) return res.status(409).json({ message: 'This mobile number is already used' });
    }
    customer.mobile = mobile;
  }
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
