const router = require('express').Router();
const ReviewController = require('../../controllers/admin/reviewController');

router.post('/add', ReviewController.AddReview);
router.get('/delete', ReviewController.DeleteReview);

// Physio Review
router.get('/get-physio-review', ReviewController.GetPhysioReview);
router.post("/addRatingToPhysio", ReviewController.addRatingToPhysio);


// Appointment Review
router.get('/get-appointment-review', ReviewController.GetPhysioApprovedReview);

// Patient Review
router.get('/get-patient-review', ReviewController.GetPatientAllReview);

module.exports = router;