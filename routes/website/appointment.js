const router = require('express').Router();

const { LoggedIn } = require('../../middleware/Appauth');

const appointmentController = require('../../controllers/website/appointmentController');

router.post('/cashAppointment', appointmentController.createAppointment);
router.get('/list', appointmentController.getAppointment);
router.post('/addAppointment', appointmentController.createAppointmentRazorpay);
router.post('/verifyPayment', appointmentController.verifyRazorpayPayment);
router.get('/appointmentByPatientId', appointmentController.getAppointmentByPatientId);
router.get('/appointmentByPhysioId', appointmentController.getAppointmentByPhysioId);
router.get('/appointmentById', appointmentController.getAppointmentById);
router.post('/sendNotificationForTreatment', appointmentController.sendNotificationForTreatment)

// Cashback
router.put('/updateCashBack' ,appointmentController.updateCashBack)
router.get('/getCashBack' ,appointmentController.getCashBack)

router.post('/addTreatmentMultiDayPayment', appointmentController.addTreatmentMultipleDayPayment);
router.post('/verifyTreatmentMultiDayPayment', appointmentController.verifyTreatmentMultipleDayPayment)
router.get('/transactionsByAppointmentId' , appointmentController.transactionsByAppointmentId)

// router.get('/appointmentPdf', appointmentController.appointmentPdf);

module.exports = router;