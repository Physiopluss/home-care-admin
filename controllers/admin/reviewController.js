const Review = require('../../models/review');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// const AWS = require('aws-sdk');
const Physio = require('../../models/physio');
const Patient = require('../../models/patient');

// Upload a file to S3
const storage = multer.diskStorage({
    // destination: (req, file, cb) => {
    //     const uploadPath = path.join(__dirname, );
    //     fs.mkdirSync(uploadPath, { recursive: true });
    //     cb(null, uploadPath);
    // },
    filename(req, file, cb) {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
});


const upload = multer({ storage: storage }).single('image');

// AWS S3 Bucket
// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });


// Add Review
exports.AddReview = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                // console.log(err);
                return res.status(400).send({ message: 'Error uploading file' });
            }

            const { rating, comment, name } = req.body;
            if (!rating && !comment && !name) {
                return res.status(400).json({
                    message: "All fields are required",
                    status: 400,
                    success: false
                });
            }

            const review = new Review({
                rating: req.body.rating,
                comment: req.body.comment,
                adminReview: true,
                name: req.body.name,
                physioId: req.body.physioId,
            });
            review.save();

            return res.status(200).json({
                message: "Rating given successfully",
                status: 200,
                success: true,
                data: review
            });
        });

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false
        });
    }
};

// delete review
exports.DeleteReview = async (req, res) => {
    try {
        let reviewId = req.query.reviewId;

        if (!reviewId) {
            return res.status(400).json({
                message: "Review ID is required",
                status: 400,
                success: false
            });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(400).json({
                message: "Review not found",
                status: 400,
                success: false
            });
        }

        await Review.findByIdAndDelete(reviewId);

        return res.status(200).json({
            message: "Review deleted successfully",
            status: 200,
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};


// Get Physio Review
exports.GetPhysioReview = async (req, res) => {
    try {
        const physioId = req.query.physioId;
        if (!physioId) {
            return res.status(400).json({
                message: "Physio ID is required",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "Physio not found",
                status: 400,
                success: false
            });
        }
        // console.log(physio);

        const reviews = await Review.find({ physioId: physio._id }).populate('patientId')
        // console.log(reviews);
        return res.status(200).json({
            message: "Reviews fetched successfully",
            status: 200,
            success: true,
            data: reviews
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

exports.addRatingToPhysio = async (req, res) => {
    try {
        const { physioId, rating } = req.body; // ✅ Use body instead of query

        if (!physioId || !rating) {
            return res.status(400).json({
                message: "physioId and Rating are mandatory",
                status: 400,
                success: false
            });
        }

        const isPhysio = await Physio.findById(physioId);

        if (!isPhysio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        isPhysio.rating = parseInt(rating, 10) || 0;

        await isPhysio.save();

        return res.status(200).json({
            message: "Rating submitted successfully",
            status: 200,
            success: true
        });

    } catch (error) {
        console.error("❌ Error in addRatingToPhysio:", error);
        return res.status(500).json({
            message: "Server error: " + error.message,
            status: 500,
            success: false
        });
    }
};


// Get Physio Approved Review
exports.GetPhysioApprovedReview = async (req, res) => {
    try {
        const { physioId, appointmentId } = req.query;
        // console.log(physioId, "jhs");
        if (!physioId) {
            return res.status(400).json({
                message: "Physio ID is required",
                status: 400,
                success: false
            });
        }

        if (!appointmentId) {
            return res.status(400).json({
                message: "Appointment ID is required",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "Physio not found",
                status: 400,
                success: false
            });
        }
        // console.log(physio);
        const reviews = await Review.find({ physioId: physio._id, appointmentId });
        // console.log(reviews);
        if (!reviews) {
            return res.status(400).json({
                message: "Review not found",
                status: 400,
                success: false
            });
        }

        return res.status(200).json({
            message: "Reviews fetched successfully",
            status: 200,
            success: true,
            data: reviews
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Get Patient All Review
exports.GetPatientAllReview = async (req, res) => {
    try {
        const { patientId, appointmentId } = req.query;
        if (!patientId) {
            return res.status(400).json({
                message: "Patient ID is required",
                status: 400,
                success: false
            });
        }

        if (!appointmentId) {
            return res.status(400).json({
                message: "Appointment ID is required",
                status: 400,
                success: false
            });
        }

        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(400).json({
                message: "Patient not found",
                status: 400,
                success: false
            });
        }

        const reviews = await Review.find({ patientId, appointmentId });
        return res.status(200).json({
            message: "Reviews fetched successfully",
            status: 200,
            success: true,
            data: reviews
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};