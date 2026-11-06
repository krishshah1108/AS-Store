const express = require('express');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { mobileError } = require('../lib/validate');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const settings = await Settings.findOne();
  if (!settings) return res.status(404).json({ message: 'Shop settings not found' });
  res.json(settings);
});

router.put('/', async (req, res) => {
  const settings = await Settings.findOne();
  if (!settings) return res.status(404).json({ message: 'Shop settings not found' });

  const shopName = String(req.body.shopName || '').trim();
  if (!shopName) return res.status(400).json({ message: 'Shop name is required' });

  const phoneMessage = mobileError(req.body.phone);
  if (phoneMessage) return res.status(400).json({ message: phoneMessage.replace('Mobile number', 'Phone') });

  const overdueDays = Number(req.body.overdueDays);
  if (!Number.isInteger(overdueDays) || overdueDays < 1) {
    return res.status(400).json({ message: 'Overdue days must be at least 1' });
  }

  const before = settings.toObject();
  settings.shopName = shopName;
  settings.address = String(req.body.address || '').trim();
  settings.phone = String(req.body.phone || '').replace(/\D/g, '');
  settings.upiId = String(req.body.upiId || '').trim();
  settings.overdueDays = overdueDays;
  settings.billFooterNote = String(req.body.billFooterNote || '').trim();
  await settings.save();

  await writeAudit({
    action: 'update',
    entityType: 'Settings',
    entityId: settings._id,
    before,
    after: settings.toObject(),
    performedBy: req.user._id,
  });
  emitChange();
  res.json(settings);
});

module.exports = router;
