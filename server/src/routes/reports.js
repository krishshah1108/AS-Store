const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDashboard, getSummary, getCustomers } = require('../controllers/reportController');

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', getDashboard);
router.get('/summary', getSummary);
router.get('/customers', getCustomers);

module.exports = router;
