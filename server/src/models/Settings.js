const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    shopName: { type: String, default: 'AS Store' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    upiId: { type: String, default: '' },
    overdueDays: { type: Number, default: 30, min: 1 },
    billFooterNote: { type: String, default: 'Thank you for your business' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
