const router = require('express').Router();
const invoiceController = require('../../controllers/admin/invoiceController');

router.get('/filter', invoiceController.getInvoice);
router.get('/get-subscription-invoice', invoiceController.getSubscriptionInvoice);
router.get('/get-patient-invoice', invoiceController.getPatientInvoice);

module.exports = router;