const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { mobileError } = require('../lib/validate');
const { login, getMe } = require('../controllers/authController');

const router = express.Router();

router.post(
  '/login',
  body('mobile').custom((value) => {
    const message = mobileError(value, true);
    if (message) throw new Error(message);
    return true;
  }),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg || 'Mobile and password required' });
    }

    await login(req, res);
  }
);

router.get('/me', requireAuth, getMe);

module.exports = router;
