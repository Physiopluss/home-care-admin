const router = require('express').Router();
const specialization = require('../../controllers/admin/specializationController');

router.post('/add', specialization.addSpecialization);
router.get('/list', specialization.getAllSpecializations);
router.post('/edit', specialization.editSpecialization)

module.exports = router;