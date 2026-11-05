const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    type: {
      type: String,
      enum: ['bill', 'payment', 'refund', 'adjustment', 'reversal', 'advance', 'return'],
      required: true,
    },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, required: true },
    refType: { type: String },
    refId: { type: mongoose.Schema.Types.ObjectId },
    note: { type: String, default: '' },
    entryDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ customerId: 1, createdAt: 1 });
ledgerEntrySchema.index({ refType: 1, refId: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
