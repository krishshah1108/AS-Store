const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');
const { mobileDigits, mobileError, moneyError, duplicateName } = require('../lib/validate');

async function applyCustomerMutation(m, userId) {
  const payload = m.payload || {};
  const clientUpdatedAt = m.clientUpdatedAt ? new Date(m.clientUpdatedAt) : new Date();

  if (m.op === 'create') {
    const name = String(payload.name || '').trim();
    if (!name) return { id: m.id, ok: false, error: 'Name is required' };
    const message = mobileError(payload.mobile);
    if (message) return { id: m.id, ok: false, error: message };
    const mobile = mobileDigits(payload.mobile);
    if (mobile && (await Customer.findOne({ mobile }))) {
      return { id: m.id, ok: false, error: 'This mobile number is already used' };
    }
    const customer = await Customer.create({
      name,
      mobile,
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
    const name = String(payload.name ?? customer.name).trim();
    if (!name) return { id: m.id, ok: false, error: 'Name is required' };
    const message = mobileError(payload.mobile ?? customer.mobile);
    if (message) return { id: m.id, ok: false, error: message };
    const mobile = mobileDigits(payload.mobile ?? customer.mobile);
    if (mobile && (await Customer.findOne({ mobile, _id: { $ne: customer._id } }))) {
      return { id: m.id, ok: false, error: 'This mobile number is already used' };
    }
    customer.name = name;
    customer.mobile = mobile;
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
    const name = String(payload.name || '').trim();
    const priceProblem = moneyError(payload.salePrice, 'Sale price', { required: true });
    if (!name) return { id: m.id, ok: false, error: 'Name is required' };
    if (priceProblem) return { id: m.id, ok: false, error: priceProblem };
    const existing = await Product.find().select('name');
    if (duplicateName(existing, name)) {
      return { id: m.id, ok: false, error: 'A product with this name already exists' };
    }
    const product = await Product.create({
      name,
      salePrice: Number(payload.salePrice),
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
    const name = String(payload.name ?? product.name).trim();
    if (!name) return { id: m.id, ok: false, error: 'Name is required' };
    const existing = await Product.find({ _id: { $ne: product._id } }).select('name');
    if (duplicateName(existing, name)) {
      return { id: m.id, ok: false, error: 'A product with this name already exists' };
    }
    if (payload.salePrice !== undefined) {
      const priceProblem = moneyError(payload.salePrice, 'Sale price', { required: true });
      if (priceProblem) return { id: m.id, ok: false, error: priceProblem };
      product.salePrice = Number(payload.salePrice);
    }
    product.name = name;
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

async function flush(req, res) {
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
}

module.exports = { flush };
