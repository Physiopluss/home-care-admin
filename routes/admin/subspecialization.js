const router = require('express').Router();
const subspecializationController = require('../../controllers/admin/subSpecializationcontroller');

router.post('/create', subspecializationController.createSubspecialization);
router.post('/list', subspecializationController.getAllSubspecialization);
router.get('/edit', subspecializationController.editSubspecialization);

module.exports = router;