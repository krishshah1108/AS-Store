const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { writeAudit } = require('../utils/audit');
const { emitChange } = require('../utils/socket');
const { duplicateName, moneyError } = require('../lib/validate');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const filter = includeInactive ? {} : { isActive: true };
  const products = await Product.find(filter).sort({ name: 1 });
  res.json(products);
});

router.post('/import', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const existing = await Product.find().select('name');
    const seen = new Set(existing.map((product) => product.name.trim().toLowerCase()));
    const docs = [];
    let duplicates = 0;
    let invalid = 0;

    for (const item of items) {
      const name = String(item.name || '').trim();
      const salePrice = Number(item.salePrice);
      if (!name || item.salePrice === '' || item.salePrice == null || !Number.isFinite(salePrice) || salePrice < 0) {
        invalid += 1;
        continue;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      docs.push({
        name,
        salePrice,
        isActive: true,
        createdBy: req.user._id,
        updatedBy: req.user._id,
        updatedAtClient: new Date(),
      });
    }

    if (docs.length) {
      await Product.insertMany(docs);
      await writeAudit({
        action: 'create',
        entityType: 'Product',
        after: { imported: docs.length, duplicates, invalid },
        performedBy: req.user._id,
      });
      emitChange();
    }

    res.status(201).json({ imported: docs.length, duplicates, invalid });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post(
  '/',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('salePrice').custom((value) => {
    const message = moneyError(value, 'Sale price', { required: true });
    if (message) throw new Error(message);
    return true;
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg || 'Invalid product data' });
    }

    const name = req.body.name.trim();
    const existing = await Product.find().select('name');
    if (duplicateName(existing, name)) {
      return res.status(409).json({ message: 'A product with this name already exists' });
    }

    const product = await Product.create({
      name,
      salePrice: Number(req.body.salePrice),
      createdBy: req.user._id,
      updatedBy: req.user._id,
      updatedAtClient: req.body.updatedAtClient ? new Date(req.body.updatedAtClient) : new Date(),
    });

    await writeAudit({
      action: 'create',
      entityType: 'Product',
      entityId: product._id,
      after: product.toObject(),
      performedBy: req.user._id,
    });

    emitChange();
    res.status(201).json(product);
  }
);

router.put('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const before = product.toObject();

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const existing = await Product.find({ _id: { $ne: product._id } }).select('name');
    if (duplicateName(existing, name)) {
      return res.status(409).json({ message: 'A product with this name already exists' });
    }
    product.name = name;
  }
  if (req.body.salePrice !== undefined) {
    const priceProblem = moneyError(req.body.salePrice, 'Sale price', { required: true });
    if (priceProblem) return res.status(400).json({ message: priceProblem });
    product.salePrice = Number(req.body.salePrice);
  }
  if (req.body.isActive !== undefined) product.isActive = Boolean(req.body.isActive);
  product.updatedBy = req.user._id;
  product.updatedAtClient = req.body.updatedAtClient ? new Date(req.body.updatedAtClient) : new Date();

  await product.save();

  await writeAudit({
    action: 'update',
    entityType: 'Product',
    entityId: product._id,
    before,
    after: product.toObject(),
    performedBy: req.user._id,
  });

  emitChange();
  res.json(product);
});

module.exports = router;
