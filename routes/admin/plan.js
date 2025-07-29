const router = require('express').Router();
const planController = require('../../controllers/admin/planController');

// Add Plans
router.post('/add', planController.addPlans);

// Get All Plans
router.get('/list', planController.getAllPlans);

// Get Plan by ID
router.get('/get', planController.getPlanById);

// Delete Plan by ID
router.delete('/delete', planController.deletePlanById);

// Update Plan by ID status
router.post('/update-status', planController.updatePlanById);

module.exports = router;
