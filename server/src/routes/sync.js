const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { flush } = require('../controllers/syncController');

const router = express.Router();
router.use(requireAuth);

router.post('/flush', flush);

module.exports = router;
