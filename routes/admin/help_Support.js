const router = require('express').Router();
const helpSupportController = require('../../controllers/admin/help_SupportController');

router.get('/list', helpSupportController.AllHelpContacts);
router.get('/update-status', helpSupportController.UpdateHelpContactStatus);


module.exports = router;