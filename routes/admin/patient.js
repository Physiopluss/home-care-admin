const router = require('express').Router();
const PatientController = require('../../controllers/admin/patientController');


router.get('/patient-list-date', PatientController.getAllPatientsDate);
router.get('/patient-activity-inactivity', PatientController.getPatientActivityAndInactivityCount);
router.get('/patient-state-count', PatientController.getPatientStateCount);

// State Wise Patient Count
router.get('/patient-state-count-signup', PatientController.getPatientStateCountSignup);
router.get('/patient-state-activity-inactivity', PatientController.getPatientStateActivityAndInactivityCount);
router.get('/patient-state-city-count', PatientController.getPatientCityCount);

// City 
router.get('/patient-city-count-signup', PatientController.getPatientCityCountSignup);
router.get('/patient-city-activity-inactivity', PatientController.getPatientCityCountActiveAndInactive);
router.get('/patient-city-pincode-count', PatientController.getPatientCityPincode);

// pinCode
router.get('/patient-pincode-count-signup', PatientController.getPatientPincode);
router.get('/patient-pincode-activity-inactivity', PatientController.getPatientPincodeActiveInactive);

router.get('/patient-count-by-patient', PatientController.getPatientCountByPatent);

router.get('/get-physio-by-patient', PatientController.getPhysioByPatientId);

router.get('/get-patient-by-appointment', PatientController.getPatientByAppointment);

router.get('/get-patient-and-physio-chat', PatientController.getPatientAndPhysioChat);

router.get('/list', PatientController.getAllPatients);

router.get('/getDeletedPatient', PatientController.getDeletedPatient);
router.delete('/delete', PatientController.deletePatient);
router.delete('/purge-patient', PatientController.purgePatient);
router.patch('/restore-patient', PatientController.restorePatient);

router.get('/today-patient', PatientController.getTodayPatients);
router.get('/cashback', PatientController.getCashback);
router.post('/pay-cashback', PatientController.payCashback);

// Treatment
router.get('/treatment-request', PatientController.getTreatmentRequest);

module.exports = router;
