const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = express.Router();
router.use(requireAuth);

router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;
