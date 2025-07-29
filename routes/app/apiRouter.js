const router = require('express').Router();

const apiController = require('../../controllers/app/apiController');
const { UnreadChatsCount, UnreadNotificationCount } = require('../../utility/helper');


router.post('/add-review', apiController.AddReview);
router.post('/like-patient-by-physio', apiController.likePatientByPhysio);
router.get('/get-patient-likes-by-physio', apiController.getPatientLikesByPhysio);

router.get('/getPhysioTreatmentRatingReview', apiController.getPhysioTreatmentRatingReview)



router.get('/all-blogs', apiController.AllBlogs);

router.get('/coupon', apiController.coupon);
router.get('/get-notification-patient', apiController.getNotificationPatient);
router.get('/get-unread-notification', apiController.getUnreadNotification)
router.get('/UnreadNotificationUpdate', apiController.getUnreadNotificationUpdate)
router.get('/UnreadChatsCount', UnreadChatsCount)
router.get('/UnreadNotificationCount', UnreadNotificationCount)

router.get('/get-physio-by-total-appointments', apiController.getPhysioByTotalAppointments);
router.get('/get-physio-by-total-reviews', apiController.getPhysioByTotalReviews);

router.post('/voucher-request', apiController.voucherRequest);

router.post("/patient-wallet-add-coin", apiController.patientAddCouponRequest)
router.get("/patient-wallet-add-coin", apiController.getPatientAddCouponRequest)

router.get('/get-help-contact', apiController.getHelpContact);
router.post('/add-help-contact', apiController.AddHelpContact);

router.post('/resend-message', apiController.resendMessage);


module.exports = router;