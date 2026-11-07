const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema(
  {
    billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentNo: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    paymentDate: { type: Date, required: true },
    kind: { type: String, enum: ['collection'], default: 'collection', required: true },
    method: {
      type: String,
      enum: ['cash', 'upi', 'mixed'],
      default: 'cash',
    },
    amounts: {
      cash: { type: Number, default: 0, min: 0 },
      upi: { type: Number, default: 0, min: 0 },
    },
    totalAmount: { type: Number, required: true, min: 0 },
    allocations: [allocationSchema],
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.index({ customerId: 1, paymentDate: -1 });
paymentSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
