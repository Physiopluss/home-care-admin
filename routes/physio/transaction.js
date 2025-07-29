const router = require('express').Router();
const transactionController = require('../../controllers/physio/transactionController');

router.get('/getPhysioTransactions', transactionController.getPhysioTransactions);
router.post('/PhysioWalletWithdrawTransactions', transactionController.PhysioWalletWithdrawTransactions);
router.get('/getWithdrawHistory', transactionController.getWithdrawHistory);
router.get('/payToPhysioPlusHistory', transactionController.payToPhysioPlusHistory);
router.post('/payToPhysioPlus', transactionController.payToPhysioPlus)
router.get('/getTransactionByAppId', transactionController.getTransactionByAppId);

module.exports = router