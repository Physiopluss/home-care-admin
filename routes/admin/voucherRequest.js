const router = require('express').Router();
const VoucherRequestController = require('../../controllers/admin/voucherRequestController');

// router.post('/create', VoucherRequestController.create);
router.get('/list', VoucherRequestController.getAllVoucherRequests);
router.post('/add-coin', VoucherRequestController.addCoin);
router.get('/get-voucher-By-patientId', VoucherRequestController.getVoucherByPatientId);

router.post('/add-coin-by-patient', VoucherRequestController.addCoinByPatient)
router.get("/today-voucher-request", VoucherRequestController.todayVoucherRequestCount)

module.exports = router;  