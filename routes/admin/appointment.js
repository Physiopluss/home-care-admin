const router = require('express').Router();
const appointmentController = require('../../controllers/admin/appointmentController');

// Appointment
router.get('/getConsultationRequestsSummary', appointmentController.getConsultationSummary)
router.get('/allConsultations', appointmentController.allConsultation)
router.get('/get-appointment-by-physio', appointmentController.getAppointment);
router.get('/completeConsultation', appointmentController.completeConsultation);
router.post('/get-appointment-chat', appointmentController.getAppointmentChat);
router.post('/addAppointment', appointmentController.addAppointment)
router.get('/allConsultationRequests', appointmentController.allConsultationRequests)
router.post('/consultationsRequestId', appointmentController.addAppointment)
router.get('/consultationRequest', appointmentController.consultationRequest);
router.post('/acceptConsultationRequest', appointmentController.acceptConsultationRequest);
router.post('/requestFilter', appointmentController.requestFilter);

router.get('/getInvoice/:id', appointmentController.getInvoice);
// Treatments
router.get('/todayTreatment', appointmentController.getAppointmentByTreatment)
router.get('/treatmentRequest', appointmentController.treatmentRequest);
router.get('/get-treatment', appointmentController.getTreatment)
router.post('/treatmentScheduleFromAdmin', appointmentController.treatmentScheduleFromAdmin)
router.post('/treatmentPayDates', appointmentController.verifyTreatmentSingleDayPayment)
router.post('/completeTreatment', appointmentController.completeTreatment)
router.post('/acceptTreatmentRequest', appointmentController.acceptTreatmentRequest);
router.get('/getAllTreatmentsData', appointmentController.getAllTreatmentsData)
router.get('/getAllTreatmentRequestsData', appointmentController.getAllTreatmentRequestsData)
router.get('/getTreatmentRequestsSummary', appointmentController.getTreatmentsSummary)
router.post('/complete-treatment', appointmentController.completeTreatment)
router.delete('/delete-treatment', appointmentController.deleteTreatment)
module.exports = router;
