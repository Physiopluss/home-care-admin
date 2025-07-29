const router = require('express').Router();
const physioController = require('../../controllers/website/physioController');



// home care
router.post('/completeTreatment', physioController.completeTreatment);
router.get('/allPhysios', physioController.getAllPhysios)
router.get('/singlePhysio', physioController.getSinglePhysioById)
















router.get('/filter', physioController.filterByPhysio);
router.post('/signUpPhysioOtp', physioController.signUpPhysioOtp);
router.post('/loginPhysioOtp', physioController.loginPhysioOtp);
router.post('/verifyOtp', physioController.verifyOtp);
// router.post('/addProfileDetails', physioController.addProfileDetails);

router.get('/physioConnectId', physioController.signUpPhysio);
router.post('/createPayment', physioController.razorpayPayment);
router.post('/verifyPayment', physioController.razorpayPaymentVerification);

router.post('/ProfessionalDetails', physioController.getProfessionalDetails);
router.post('/workExperiences', physioController.getWorkExperiences);


router.post('/physioPaymentFree', physioController.physioPaymentFree);

router.post('/PhysioWalletWithdrawTransaction', physioController.PhysioWalletWithdrawTransaction);
router.get('/getPhysioWalletTransaction', physioController.getPhysioTransaction);
router.get('/getPhysioWalletWithdrawalRequest', physioController.getPhysioWithdrawalRequest);
router.get('/getPhysioAmountTransaction', physioController.getPhysioWithdrawalRequest)
router.get('/getPhysioWalletData', physioController.getPhysioWalletData)


router.get('/physioByid', physioController.getPhysioById);
router.get('/getPhysio', physioController.getPhysio);
router.post('/AddPhysioReviews', physioController.AddPhysioReviews);
router.get('/getPhysioReviews', physioController.getPhysioReviews);

// import blog
router.post('/import-blogs', physioController.importBlogs);

// Physio Connect Routes
router.post('/createPhysioPersonalDetails', physioController.createPhysioPersonalDetails);
router.post('/createPhysioProfessionalDetails', physioController.createPhysioProfessionalDetails);
router.post('/createPhysioBusinessDetails', physioController.createPhysioBusinessDetails);
router.put('/physioConnectProfileEdit', physioController.physioConnectProfileEdit);
router.get("/getPhysioDetailsById", physioController.getPhysioDetailsById);
router.post('/coupon', physioController.GetCouponByCode);
router.post("/request-refund", physioController.requestRefund);


module.exports = router;