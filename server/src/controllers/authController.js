const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { mobileDigits } = require('../lib/validate');

async function login(req, res) {
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

function getMe(req, res) {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      mobile: req.user.mobile,
      role: req.user.role,
    },
  });
}

module.exports = { login, getMe };
