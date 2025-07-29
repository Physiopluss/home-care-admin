const router = require('express').Router();
const appointmentController = require('../../controllers/physio/appointmentController');

router.get('/getAppointmentByPhysio', appointmentController.getPhysioAppointments);
router.post('/completeAppointment', appointmentController.completeAppointment);
router.post('/completeTreatment', appointmentController.completeTreatment);
router.post('/cashAppointment', appointmentController.cashAppointmentPayment);
router.get('/getAppointmentsStatus', appointmentController.getAppointmentsStatus);
router.get('/get-today-appointment', appointmentController.getTodayAppointments);
router.get('/getAppointmentCompleted', appointmentController.getAppointmentComplete);

router.post('/debit-physio-amount', appointmentController.debitPhysioAmount);
router.post('/treatmentSchedule', appointmentController.treatmentSchedule);
router.post('/reScheduletreatment', appointmentController.reScheduleTreatment)

router.get('/singleAppointment', appointmentController.singleAppointment);
router.post('/cash-Treatment-Payment', appointmentController.treatmentPayment);
router.post('/rescheduleAppointment', appointmentController.rescheduleAppointment);
router.get('/getCompletedAppointments', appointmentController.getCompletedAppointments);
router.get('/getTreatedPatients', appointmentController.getTreatedPatients);

module.exports = router;
