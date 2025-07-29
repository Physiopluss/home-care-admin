const router = require('express').Router();
const PhysioProfileEditController = require('../../controllers/admin/physioProfileEditController')

router.get('/get-physio-profile-edit', PhysioProfileEditController.getPhysioProfileEdit);

router.post('/physio-profile-updateStatus', PhysioProfileEditController.updateStatus);

router.get('/get-physio-single-profile-edit', PhysioProfileEditController.getSinglePhysioProfile);

router.post('/physio-profile-edit', PhysioProfileEditController.editPhysioProfile);

router.get('/physio-profile-approval', PhysioProfileEditController.physioProfileEditApproval);

module.exports = router;