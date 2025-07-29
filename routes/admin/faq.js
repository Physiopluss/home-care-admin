const router = require('express').Router();
const FaqController = require('../../controllers/admin/FaqController');

router.post('/add', FaqController.AddFaq);
router.get('/list', FaqController.AllFaqs);
router.post('/update', FaqController.EditFaq);
router.get('/delete', FaqController.DeleteFaq);

module.exports = router;