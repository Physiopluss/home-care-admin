const router = require('express').Router();
const authController = require('../../controllers/physio/authController');

router.post('/signup-otp', authController.signUpPhysioOtp);
router.get('/login-otp', authController.loginPhysioOtp);
router.post("/add-wallet-amount", authController.addWalletAmount);
router.post("/verify-wallet-amount", authController.VerifyWalletAmount);
router.get('/physioRevenue', authController.physioRevenue)

router.post('/recoverDeletedPhysio', authController.recoverDeletedPhysio)
router.post('/verify-otp', authController.verifyOtpPhysio);
router.get('/get-physio', authController.getPhysioById);
router.delete('/delete', authController.deletePhysio);
router.get('/get-professional-details', authController.getProfessionalDetails);
router.get('/get-business-details', authController.getBusinessDetails);



module.exports = router;