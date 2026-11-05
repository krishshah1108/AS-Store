const express = require('express');
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const settings = await Settings.findOne();
  if (!settings) return res.status(404).json({ message: 'Shop settings not found' });
  res.json(settings);
});

module.exports = router;
