const router = require('express').Router();
const transactionController = require('../../controllers/admin/transactionController');

router.get('/getPhysioWithdrawalRequest', transactionController.getPhysioWithdrawalRequest);

// physio withdrawal request
router.get('/getPhystiWithdrawalRequest', transactionController.getPhystiWithdrawalRequest);

// physio transaction
router.get('/getPhysioOnlineTransactions', transactionController.getPhysioOnlineTransaction);
router.get('/getPhysioCashTransactions', transactionController.getPhysioCashTransaction);
router.get('/getPhysioWithdrawalRequestByDate', transactionController.getPhysioWithdrawalRequestByDate);
router.put('/updateWithdrawStatus',transactionController.updateWithdrawStatus)
router.get('/payToPhysioPlusHistory',transactionController.payToPhysioPlusHistory)
// 
router.post("/approvePhysioWithdrawalRequest", transactionController.approvePhysioWithdrawalRequest);
router.get("/getPatientTransaction", transactionController.getPatientTransaction);
router.get("/withdrawal-invoice", transactionController.withdrawalInvoice);
router.get("/getPatientTransactionByDate", transactionController.physioRevenue)

module.exports = router;