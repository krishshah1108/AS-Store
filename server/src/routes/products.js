const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { moneyError } = require('../lib/validate');
const { listProducts, importProducts, createProduct, updateProduct } = require('../controllers/productController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listProducts);
router.post('/import', importProducts);

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

    await createProduct(req, res);
  }
);

router.put('/:id', updateProduct);

module.exports = router;
