const express = require('express');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');

const router = express.Router();
router.use(requireAuth);

router.post('/flush', async (req, res) => {
  const mutations = Array.isArray(req.body.mutations) ? req.body.mutations : [];
  const results = [];

  for (const m of mutations) {
    try {
      if (m.entity === 'customer') {
        results.push(await applyCustomerMutation(m, req.user._id));
      } else if (m.entity === 'product') {
        results.push(await applyProductMutation(m, req.user._id));
      } else {
        results.push({ id: m.id, ok: false, error: 'Unknown entity' });
      }
    } catch (err) {
      results.push({ id: m.id, ok: false, error: err.message });
    }
  }

  res.json({ results });
});

async function applyCustomerMutation(m, userId) {
  const payload = m.payload || {};
  const clientUpdatedAt = m.clientUpdatedAt ? new Date(m.clientUpdatedAt) : new Date();

  if (m.op === 'create') {
    const customer = await Customer.create({
      name: String(payload.name || '').trim(),
      mobile: String(payload.mobile || '').trim(),
      address: String(payload.address || '').trim(),
      notes: String(payload.notes || '').trim(),
      isActive: payload.isActive !== false,
      createdBy: userId,
      updatedBy: userId,
      updatedAtClient: clientUpdatedAt,
    });

    await writeAudit({
      action: 'create',
      entityType: 'Customer',
      entityId: customer._id,
      after: customer.toObject(),
      performedBy: userId,
      meta: { sync: true, localId: m.id },
    });
    emitChange();
    return { id: m.id, ok: true, serverId: customer._id };
  }

  if (m.op === 'update') {
    const customer = await Customer.findById(payload._id);
    if (!customer) return { id: m.id, ok: false, error: 'Not found' };

    const before = customer.toObject();
    customer.name = String(payload.name ?? customer.name).trim();
    customer.mobile = String(payload.mobile ?? customer.mobile).trim();
    customer.address = String(payload.address ?? customer.address).trim();
    customer.notes = String(payload.notes ?? customer.notes).trim();
    if (payload.isActive !== undefined) customer.isActive = Boolean(payload.isActive);
    customer.updatedBy = userId;
    customer.updatedAtClient = clientUpdatedAt;
    await customer.save();

    await writeAudit({
      action: 'update',
      entityType: 'Customer',
      entityId: customer._id,
      before,
      after: customer.toObject(),
      performedBy: userId,
      meta: { sync: true },
    });
    emitChange();
    return { id: m.id, ok: true, serverId: customer._id };
  }

  return { id: m.id, ok: false, error: 'Unknown op' };
}

async function applyProductMutation(m, userId) {
  const payload = m.payload || {};
  const clientUpdatedAt = m.clientUpdatedAt ? new Date(m.clientUpdatedAt) : new Date();

  if (m.op === 'create') {
    const product = await Product.create({
      name: String(payload.name || '').trim(),
      unit: String(payload.unit || 'pcs').trim(),
      salePrice: Number(payload.salePrice) || 0,
      isActive: payload.isActive !== false,
      createdBy: userId,
      updatedBy: userId,
      updatedAtClient: clientUpdatedAt,
    });

    await writeAudit({
      action: 'create',
      entityType: 'Product',
      entityId: product._id,
      after: product.toObject(),
      performedBy: userId,
      meta: { sync: true, localId: m.id },
    });
    emitChange();
    return { id: m.id, ok: true, serverId: product._id };
  }

  if (m.op === 'update') {
    const product = await Product.findById(payload._id);
    if (!product) return { id: m.id, ok: false, error: 'Not found' };

    const before = product.toObject();
    product.name = String(payload.name ?? product.name).trim();
    product.unit = String(payload.unit ?? product.unit).trim();
    if (payload.salePrice !== undefined) product.salePrice = Number(payload.salePrice);
    if (payload.isActive !== undefined) product.isActive = Boolean(payload.isActive);
    product.updatedBy = userId;
    product.updatedAtClient = clientUpdatedAt;
    await product.save();

    await writeAudit({
      action: 'update',
      entityType: 'Product',
      entityId: product._id,
      before,
      after: product.toObject(),
      performedBy: userId,
      meta: { sync: true },
    });
    emitChange();
    return { id: m.id, ok: true, serverId: product._id };
  }

  return { id: m.id, ok: false, error: 'Unknown op' };
}

module.exports = router;
