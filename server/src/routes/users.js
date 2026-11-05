const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (_req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: 1 });
  res.json(users);
});

router.post(
  '/',
  requireOwner,
  body('name').trim().notEmpty(),
  body('mobile').trim().notEmpty(),
  body('password').isLength({ min: 4 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const { name, mobile, password } = req.body;
    const role = req.body.role === 'owner' ? 'owner' : 'employee';
    const exists = await User.findOne({ mobile: String(mobile).trim() });
    if (exists) {
      return res.status(409).json({ message: 'Mobile already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      mobile: String(mobile).trim(),
      passwordHash,
      role,
      isActive: true,
    });

    await writeAudit({
      action: 'create',
      entityType: 'User',
      entityId: user._id,
      after: { name: user.name, mobile: user.mobile, role: user.role },
      performedBy: req.user._id,
    });

    emitChange();

    res.status(201).json({
      id: user._id,
      name: user.name,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
    });
  }
);

router.patch('/:id/active', requireOwner, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const nextActive = Boolean(req.body.isActive);
  if (!nextActive && String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot deactivate your own login' });
  }
  if (!nextActive && user.role === 'owner') {
    const otherOwners = await User.countDocuments({
      role: 'owner',
      isActive: true,
      _id: { $ne: user._id },
    });
    if (otherOwners === 0) {
      return res.status(400).json({ message: 'Keep at least one active owner' });
    }
  }

  const before = { isActive: user.isActive };
  user.isActive = nextActive;
  await user.save();

  await writeAudit({
    action: 'update',
    entityType: 'User',
    entityId: user._id,
    before,
    after: { isActive: user.isActive },
    performedBy: req.user._id,
  });

  emitChange();
  res.json({ id: user._id, isActive: user.isActive });
});

module.exports = router;
