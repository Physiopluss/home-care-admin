const routers = require('express').Router();
const appointmentController = require('../../controllers/app/appointmentController');

routers.post('/cashAppointment', appointmentController.createAppointment);
routers.get('/list', appointmentController.getAppointment);
routers.post('/addAppointment', appointmentController.createAppointmentRazorpay);
routers.post('/verifyPayment', appointmentController.verifyRazorpayPayment);
routers.get('/getAppointmentByPatient', appointmentController.getPatientAppointments);
routers.post('/addAppointmentAddress', appointmentController.addAppointmentAddress)
routers.put('/editAppointmentAddress', appointmentController.editAppointmentAddress)
// routers.post('/completeAppointment', appointmentController.completeAppointment);
// routers.get('/getAppointmentsStatus', appointmentController.getAppointmentsStatus);

// treatmentSchedule
// routers.post("/treatmentSchedule", appointmentController.treatmentSchedule)  

routers.post('/addTreatmentSingleDayPayment', appointmentController.addTreatmentSingleDayPayment);
routers.post('/verifyTreatmentSingleDayPayment', appointmentController.verifyTreatmentSingleDayPayment)

routers.post('/singleDayPaymentCash', appointmentController.singleDayPaymentCash);

routers.post('/addTreatmentMultiDayPayment', appointmentController.addTreatmentMultipleDayPayment);
routers.post('/verifyTreatmentMultiDayPayment', appointmentController.verifyTreatmentMultipleDayPayment)

routers.post('/multipleDayPaymentCash', appointmentController.multipleDayPaymentCash);
routers.put('/updateCashBack' ,appointmentController.updateCashBack)

routers.get('/singleAppointment', appointmentController.singleAppointment);
routers.get('/sendNotificationForTreatment' ,appointmentController.sendNotificationForTreatment)

routers.post('/addRehabSingleDayPayment', appointmentController.addRehabSingleDayPayment);
routers.post('/verifyRehabSingleDayPayment', appointmentController.verifyRehabSingleDayPayment)

routers.post('/addRehabMultiDayPayment', appointmentController.addRehabMultipleDayPayment);
routers.post('/verifyRehabMultiDayPayment', appointmentController.verifyRehabMultipleDayPayment)

routers.post('/rescheduleAppointment', appointmentController.rescheduleAppointment);

routers.get('/getAppointmentInvoice', appointmentController.getAppointmentInvoice);
routers.get('/createAppointmentInvoice', appointmentController.createAppointmentInvoice);


module.exports = routers; 