const router = require('express').Router();
const Transaction = require('../../controllers/app/transactionController');

// router.get('/getPhysioTransactions', Transaction.getPhysioTransactions);
// router.post('/PhysioWalletWithdrawTransactions', Transaction.PhysioWalletWithdrawTransactions);

router.get('/getPatientTransactions', Transaction.getPatientTransactions)
router.get('/getInvoice', Transaction.getInvoice)

module.exports = router