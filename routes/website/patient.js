const router = require('express').Router();
const patientController = require('../../controllers/website/patientController');

router.post('/signUpOtp', patientController.signUpOtp);
router.post('/loginOtp', patientController.loginOtp);
router.post('/verifyOtp', patientController.verifyOtp);
router.get('/getPatientById', patientController.patientById);
router.put('/updatePatient/:id', patientController.editProfile)
router.get('/getPatientAppointments', patientController.getPatientAppointments);
router.get('/getPatientTreatments', patientController.getPatientAppointments);
router.get('/singleAppointment', patientController.singleAppointment);
router.get('/singleTreatment', patientController.singleTreatment);
router.get('/getInvoice', patientController.getInvoice);
router.post("/addRatingToPhysio", patientController.addRatingToPhysio);
router.post('/coupon', patientController.GetCouponByCode);



// appointment
router.post('/cashAppointment', patientController.createAppointment);
router.post('/addAppointment', patientController.createAppointmentRazorpay);
router.post('/verifyPayment', patientController.verifyRazorpayPayment);
router.get('/sendNotificationForTreatment', patientController.sendNotificationForTreatment)
router.post('/payTreatmentDay', patientController.addTreatmentPayment);
router.post('/verifyTreatmentPayment', patientController.verifyTreatmentPayment)
// router.post('/addTreatmentMultiDayPayment', patientController.addTreatmentMultipleDayPayment);
// router.post('/verifyTreatmentMultiDayPayment', patientController.verifyTreatmentMultipleDayPayment)
router.post('/singleDayPaymentCash', patientController.singleDayPaymentCash);
router.post('/multipleDayPaymentCash', patientController.multipleDayPaymentCash);
router.put('/updateCashBack', patientController.updateCashBack)

module.exports = router;









