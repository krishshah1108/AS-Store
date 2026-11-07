const Settings = require('../models/Settings');
const { mobileError } = require('../lib/validate');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');

async function getOrCreateSettings() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
}

async function getSettings(_req, res) {
  res.json(await getOrCreateSettings());
}

async function updateSettings(req, res) {
  const settings = await getOrCreateSettings();

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
}

module.exports = {
  getSettings,
  updateSettings,
};
