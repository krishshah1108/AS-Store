const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { mobileError } = require('../lib/validate');
const { listCustomers, createCustomer, updateCustomer } = require('../controllers/customerController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listCustomers);

router.post(
  '/',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('mobile')
    .optional({ values: 'falsy' })
    .custom((value) => {
      const message = mobileError(value);
      if (message) throw new Error(message);
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    await createCustomer(req, res);
  }
);

router.put('/:id', updateCustomer);

module.exports = router;
