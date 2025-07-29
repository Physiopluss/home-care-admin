const router = require('express').Router();
const apiController = require('../../controllers/physio/apiController');


router.get('/get-physio-reviews', apiController.GetPhysioReviews);

// help
router.post('/add-help-contact', apiController.AddHelpContact);
router.get('/helpByPhysio', apiController.helpByPhysio);

// specialization
router.get('/get-sub-specialization', apiController.GetSubSpecialization);

// coupon
// subscription
router.post('/get-physio-by-plan', apiController.GetPhysioByPlan);
router.get('/get-subscription-by-physio', apiController.GetPhysioBySubscription);
// notification
router.get('/get-notification', apiController.getNotification);
router.get('/UnreadNotificationUpdate', apiController.getUnreadNotificationUpdate)
router.get('/getUnreadNotification', apiController.getUnreadNotification)
router.put('/addApplicationVersion',apiController.addApplicationVersion )
module.exports = router;