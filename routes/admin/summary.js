const router = require('express').Router();
const SummaryController = require('../../controllers/admin/summaryController');

// Physio Side
router.get('/summary-state-wise', SummaryController.getSummaryStateWise);
router.get('/summary-city-wise', SummaryController.getSummaryCityWise);
router.get('/summary-physios', SummaryController.getSummaryPhysios);
router.get('/filter-physios', SummaryController.filterPhysios);

// Patient Side
router.get('/summary-patients', SummaryController.getSummaryPatients);
router.get('/patient-states', SummaryController.getPatientStates);
router.get('/patient-cities', SummaryController.getPatientCities);
router.get('/filter-patients', SummaryController.filterPatient);

module.exports = router;
