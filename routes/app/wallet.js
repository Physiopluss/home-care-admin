const { walletDetails, walletTransactions, singleTransaction, submitWithdrawlRequest, getAllWithdrawlRequest, getSingleWithdrawlRequest, updateWithdrawlRequest, getAllWithdrawlRequestAdmin } = require('../../controllers/app/wallet')
const verifyToken = require('../../middleware/auth')
const router =require('express').Router()

router.get('/details/:physioId',verifyToken,walletDetails)

router.get('/transactions/:walletId',verifyToken,walletTransactions)

router.get('/transaction/single/:transactionId',verifyToken,singleTransaction)

router.post('/withdrawl-request/submit/:physioId',verifyToken,submitWithdrawlRequest)

router.get('/withdrawl-request/all/:walletId',verifyToken,getAllWithdrawlRequest)

router.get('/withdrawl-request/single/:requestId',verifyToken,getSingleWithdrawlRequest)

router.get('/withdrawl/request/admin',getAllWithdrawlRequestAdmin)

router.put('/update/status/request/:requestId',updateWithdrawlRequest)

module.exports=router