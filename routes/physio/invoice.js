const router = require('express').Router();
const invoiceController = require('../../controllers/physio/invoiceController');

router.get('/getInvoice', invoiceController.getInvoice);
router.get('/subscription', invoiceController.getSubscriptionInvoice);


module.exports = router;