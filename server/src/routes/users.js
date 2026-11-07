const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { mobileError } = require('../lib/validate');
const { listUsers, createUser, toggleUserActive } = require('../controllers/userController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listUsers);

router.post(
  '/',
  requireOwner,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('mobile').custom((value) => {
    const message = mobileError(value, true);
    if (message) throw new Error(message);
    return true;
  }),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg || 'Invalid input' });
    }

    await createUser(req, res);
  }
);

router.patch('/:id/active', requireOwner, toggleUserActive);

module.exports = router;
