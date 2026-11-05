const express = require('express');
const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');
const {
  computeTotals,
  normalizePayments,
  nextBillNo,
  reverseBillLedger,
  applyBillLedger,
  snapshotBill,
  deleteBill,
  returnBillItems,
} = require('../services/billing');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.q) {
    const q = String(req.query.q).trim();
    filter.$or = [{ billNo: { $regex: q, $options: 'i' } }, { notes: { $regex: q, $options: 'i' } }];
  }

  const bills = await Bill.find(filter)
    .populate('customerId', 'name')
    .sort({ billDate: -1, createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 100, 300));

  res.json(bills);
});

router.get('/:id', async (req, res) => {
  const bill = await Bill.findById(req.params.id)
    .populate('customerId', 'name mobile')
    .populate('revisions.by', 'name');

  if (!bill) return res.status(404).json({ message: 'Bill not found' });
  res.json(bill);
});

router.post('/', async (req, res) => {
  try {
    const customer = await Customer.findById(req.body.customerId);
    if (!customer || !customer.isActive) {
      return res.status(400).json({ message: 'Valid active customer required' });
    }

    const { items, subtotal, discount, total } = computeTotals(req.body.items, req.body.discount);
    if (!items.length || items.some((i) => !i.name || i.qty <= 0)) {
      return res.status(400).json({ message: 'Each item needs a name and qty > 0' });
    }

    const { payments, paidAmount, dueAmount } = normalizePayments(req.body.payments, total);
    const billDate = req.body.billDate ? new Date(req.body.billDate) : new Date();
    const billNo = await nextBillNo();

    const bill = await Bill.create({
      billNo,
      customerId: customer._id,
      billDate,
      items,
      subtotal,
      discount,
      total,
      payments,
      paidAmount,
      dueAmount,
      notes: (req.body.notes || '').trim(),
      status: 'final',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await applyBillLedger(bill, req.user._id);

    await writeAudit({
      action: 'create',
      entityType: 'Bill',
      entityId: bill._id,
      after: snapshotBill(bill),
      performedBy: req.user._id,
    });

    emitChange();

    res.status(201).json(bill);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.status === 'cancelled') {
      return res.status(400).json({ message: 'Cancelled bills cannot be edited' });
    }

    const before = snapshotBill(bill);
    const customerId = req.body.customerId || bill.customerId;
    const customer = await Customer.findById(customerId);
    if (!customer || !customer.isActive) {
      return res.status(400).json({ message: 'Valid active customer required' });
    }

    const { items, subtotal, discount, total } = computeTotals(
      req.body.items || bill.items,
      req.body.discount !== undefined ? req.body.discount : bill.discount
    );
    if (!items.length || items.some((i) => !i.name || i.qty <= 0)) {
      return res.status(400).json({ message: 'Each item needs a name and qty > 0' });
    }

    const { payments, paidAmount, dueAmount } = normalizePayments(
      req.body.payments || bill.payments,
      total
    );

    await reverseBillLedger(bill, req.user._id, `Edit reverse ${bill.billNo}`);

    bill.customerId = customerId;
    bill.billDate = req.body.billDate ? new Date(req.body.billDate) : bill.billDate;
    bill.items = items;
    bill.subtotal = subtotal;
    bill.discount = discount;
    bill.total = total;
    bill.payments = payments;
    bill.paidAmount = paidAmount;
    bill.dueAmount = dueAmount;
    bill.notes = req.body.notes !== undefined ? String(req.body.notes).trim() : bill.notes;
    bill.updatedBy = req.user._id;
    bill.revisions.push({
      at: new Date(),
      by: req.user._id,
      reason: (req.body.reason || 'Bill edited').trim(),
      before,
      after: null,
    });

    await bill.save();
    await applyBillLedger(bill, req.user._id);

    const after = snapshotBill(bill);
    bill.revisions[bill.revisions.length - 1].after = after;
    await bill.save();

    await writeAudit({
      action: 'update',
      entityType: 'Bill',
      entityId: bill._id,
      before,
      after,
      performedBy: req.user._id,
    });

    emitChange();

    const populated = await Bill.findById(bill._id)
      .populate('customerId', 'name mobile')
      .populate('revisions.by', 'name');

    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const before = await deleteBill(req.params.id, req.user._id);
    await writeAudit({
      action: 'delete',
      entityType: 'Bill',
      entityId: req.params.id,
      before,
      performedBy: req.user._id,
    });
    emitChange();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const result = await returnBillItems(
      req.params.id,
      { items: req.body.items || [], notes: req.body.notes },
      req.user._id
    );
    await writeAudit({
      action: 'update',
      entityType: 'Bill',
      entityId: result.bill._id,
      after: snapshotBill(result.bill),
      performedBy: req.user._id,
    });
    emitChange();
    const populated = await Bill.findById(result.bill._id)
      .populate('customerId', 'name mobile')
      .populate('revisions.by', 'name');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
