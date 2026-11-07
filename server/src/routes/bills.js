const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listBills,
  getBillActivity,
  getBillPayments,
  createBillPayment,
  getBillById,
  createBill,
  updateBill,
  deleteBillById,
  returnBill,
} = require('../controllers/billController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listBills);
router.get('/:id/activity', getBillActivity);
router.get('/:id/payments', getBillPayments);
router.post('/:id/payments', createBillPayment);
router.get('/:id', getBillById);
router.post('/', createBill);
router.put('/:id', updateBill);
router.delete('/:id', deleteBillById);
router.post('/:id/return', returnBill);

module.exports = router;
