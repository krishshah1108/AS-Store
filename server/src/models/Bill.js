const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentSplitSchema = new mongoose.Schema(
  {
    cash: { type: Number, default: 0, min: 0 },
    upi: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const revisionSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    billDate: { type: Date, required: true },
    items: { type: [billItemSchema], validate: [(v) => v.length > 0, 'At least one item required'] },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    payments: { type: paymentSplitSchema, default: () => ({}) },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['final', 'cancelled', 'returned'], default: 'final' },
    notes: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
    returnNote: { type: String, default: '' },
    revisions: [revisionSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true,
      required: function createdByRequired() {
        return this.isNew
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

billSchema.index({ billDate: -1 });
billSchema.index({ customerId: 1, billDate: -1 });
billSchema.index({ status: 1 });
billSchema.index({ createdBy: 1, billDate: -1 });

module.exports = mongoose.model('Bill', billSchema);
