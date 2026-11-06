const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { mobileDigits, mobileError } = require('../lib/validate');

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

    const mobile = mobileDigits(req.body.mobile);
    const { password } = req.body;
    const user = await User.findOne({ mobile });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid mobile or password' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid mobile or password' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
      },
    });
  }
);

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      mobile: req.user.mobile,
      role: req.user.role,
    },
  });
});

module.exports = router;
