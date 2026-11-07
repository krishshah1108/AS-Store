const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getLedger } = require('../controllers/ledgerController');

const router = express.Router();
router.use(requireAuth);

router.get('/', getLedger);

module.exports = router;
