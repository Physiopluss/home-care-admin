const Degree = require('../../models/Degree');
const Physio = require('../../models/physio')
const Patient = require('../../models/patient')
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// const AWS = require('aws-sdk');
const Transaction = require("../../models/transaction")
const Subscription = require("../../models/subscription")
const Appointment = require("../../models/appointment")
const mongoose = require('mongoose');
const crypto = require('crypto');
const { isValidObjectId } = mongoose;
const moment = require('moment-timezone');
const { sendFCMNotification } = require('../../services/fcmService');
const notification = require('../../models/notification');
const { redisClient, CACHE_EXPIRATION } = require('../../utility/redisClient');
const { deleteFileFromS3 } = require('../../services/awsService');
const invoice = require('../../models/invoice');
const Review = require('../../models/review');
const Plan = require('../../models/plan');
// Set The Storage Engine
const storage = multer.diskStorage({
    // destination: (req, file, cb) => {
    //     const uploadPath = path.join(__dirname, '../uploads/blog');
    //     fs.mkdirSync(uploadPath, { recursive: true });
    //     cb(null, uploadPath);
    //   },
    filename(req, file, cb) {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
});


// upload function
const upload = multer({ storage: storage }).fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'degreeImage', maxCount: 5 },
    { name: 'iapImage', maxCount: 1 },
    { name: 'imagesClinic', maxCount: 10 },
    { name: 'achievementImages', maxCount: 10 },
    { name: 'bptDegreeImage', maxCount: 1 },
    { name: 'mptDegreeImage', maxCount: 1 },
]);

function generateUnique6CharID() {
    // Define the characters to include in the ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charsLength = chars.length;

    // Generate 6 random characters
    let id = '';
    for (let i = 0; i < 8; i++) {
        // Generate a random index based on the chars length
        const randomIndex = crypto.randomBytes(1)[0] % charsLength;
        // Append the character at the random index to the ID
        id += chars[randomIndex];
    }

    return id;
}


// AWS S3 bucket configuration
// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });


exports.getDeletedPhysio = async (req, res) => {
    try {
        const { name } = req.query;
        let query = { isDeleted: true };

        if (name) {
            query.fullName = { $regex: name.toLowerCase().trim(), $options: 'i' };
        }

        const deletedPhysio = await Physio.find(query);

        return res.status(200).json({
            message: 'Deleted physiotherapists fetched successfully',
            success: true,
            status: 200,
            data: deletedPhysio
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Server error',
            success: false
        });
    }
}


exports.AllPhysio = async (req, res) => {
    try {
        const {
            name,
            onboardedFrom,
            date,
            freePhysio,
            planType,
            page = 1,
            perPage = 10,
            cache = false
        } = req.query;
        const currentPage = parseInt(page);
        const limit = parseInt(perPage);
        const skip = (currentPage - 1) * limit;

        let query = {
            isDeleted: false, isBlocked: false
        };

        if (name) {
            const searchTerm = name.toLowerCase().trim();
            query.$or = [
                { fullName: { $regex: searchTerm, $options: 'i' } },
                { phone: { $regex: searchTerm, $options: 'i' } },
                { zipCode: { $regex: searchTerm, $options: 'i' } },
            ]
        }

        if (date) {
            const startOfDayIST = moment.tz(date, 'Asia/Kolkata').startOf('day');
            const endOfDayIST = moment.tz(date, 'Asia/Kolkata').endOf('day');
            const startUTC = new Date(startOfDayIST.toISOString());
            const endUTC = new Date(endOfDayIST.toISOString());
            query.createdAt = { $gte: startUTC, $lte: endUTC };
        }

        // Caching logic
        let cacheKey = null;
        if (cache) {
            const keys = { name, onboardedFrom, date, freePhysio, planType, page, perPage };
            const hash = crypto.createHash('sha256').update(JSON.stringify(keys)).digest('hex');
            cacheKey = `admin:AllPhysio:${hash}`;
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log("> Returning cached data (Admin AllPhysio)");
                return res.status(200).json({
                    message: "All physios",
                    status: 200,
                    success: true,
                    ...JSON.parse(cachedData),
                    query
                });
            }
        }

        if (freePhysio) {
            switch (freePhysio) {
                case "approved":
                    query.accountStatus = 1
                    break;
                case "unApproved": query.accountStatus = 0
                default:
                    break;
            }
        }
        // Aggregation pipeline
        const aggregationPipeline = [
            { $match: query },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            {
                $unwind: {
                    path: '$subscription',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            {
                $unwind: {
                    path: '$plan',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $facet: {
                    data: [
                        { $skip: skip },
                        { $limit: limit }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
                }
            }
        ];

        const [result] = await Physio.aggregate(aggregationPipeline);
        const totalCount = result.totalCount[0]?.count || 0;


        const responseData = {
            message: "All physios",
            status: 200,
            success: true,
            data: result.data,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage,
            query
        };

        if (cache) {
            await redisClient.set(cacheKey, JSON.stringify(responseData), {
                EX: CACHE_EXPIRATION.ONE_HOUR
            });
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again. " + error.message,
            status: 500,
            success: false
        });
    }
};


exports.allPhysioConnect = async (req, res) => {
    try {
        const {
            name,
            date,
            page = 1,
            perPage = 10,
            isPaid,
            cache = false
        } = req.query;

        const currentPage = parseInt(page);
        const limit = parseInt(perPage);
        const skip = (currentPage - 1) * limit;

        let query = { isDeleted: false, isBlocked: false, isPhysioConnect: true };

        if (isPaid == 'paid') {
            query.isPhysioConnectPaid = true;
        } else if (isPaid == 'pending') {
            query.isPhysioConnectPaid = false;
        } else if (isPaid == 'completed') {
            query.isPhysioConnectProfileCompleted = true;
        } else if (isPaid == 'refund') {
            query.isPhysioConnectPaid = true;
            query.isPhysioConnectRefundRequest = true;
        };

        if (name) {
            query.fullName = { $regex: name.toLowerCase().trim(), $options: 'i' };
        }

        if (date) {
            const startOfDayIST = moment.tz(date, 'Asia/Kolkata').startOf('day');
            const endOfDayIST = moment.tz(date, 'Asia/Kolkata').endOf('day');
            const startUTC = new Date(startOfDayIST.toISOString());
            const endUTC = new Date(endOfDayIST.toISOString());
            query.createdAt = { $gte: startUTC, $lte: endUTC };
        }

        // Caching logic
        let cacheKey = null;
        if (cache) {
            const keys = { name, date, page, perPage, isPaid };
            const hash = crypto.createHash('sha256').update(JSON.stringify(keys)).digest('hex');
            cacheKey = `admin:AllPhysioConnect:${hash}`;
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log("> Returning cached data (Admin AllPhysioConnect)");
                return res.status(200).json({
                    message: "All physios connect",
                    status: 200,
                    success: true,
                    ...JSON.parse(cachedData),
                    query
                });
            }
        }

        // Aggregation pipeline
        const aggregationPipeline = [
            { $match: query },
            { $sort: { isPhysioConnectPaidDate: -1 } },
            {
                $facet: {
                    data: [
                        { $skip: skip },
                        { $limit: limit }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
                }
            }
        ];


        const [result] = await physioConnect.aggregate(aggregationPipeline);
        const totalCount = result.totalCount[0]?.count || 0;

        const responseData = {
            message: "All physios connect",
            status: 200,
            success: true,
            data: result.data,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage,
            query
        };

        if (cache) {
            await redisClient.set(cacheKey, JSON.stringify(responseData), {
                EX: CACHE_EXPIRATION.ONE_HOUR
            });
        }

        return res.status(200).json(responseData);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again. " + error.message,
            status: 500,
            success: false
        });
    }
};

exports.getTreatmentsSummary = async (req, res) => {

}


exports.transferPhysioConnect = async (req, res) => {
    try {
        const { physioId } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId);

        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        physio.isPhysioConnectTransferred = true;
        await physio.save();

        return res.status(200).json({
            message: "Physio connect transferred successfully",
            status: 200,
            success: true
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again. " + error.message,
            status: 500,
            success: false
        });
    }
}


// Get single physio by id
exports.physioById = async (req, res) => {
    try {
        let id = req.query.PhysioId;

        if (!id) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(id).populate({
            path: 'subscriptionId',
            select: 'planId',
            populate: {
                path: 'planId',
                model: 'Plan',
                select: 'planType'
            }
        });

        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        // Return Temporary Invoice
        const fetchedInvoice = await invoice.findOne({
            physioId: id,
            type: "subscription",
            subscriptionId: null,
            couponName: physio.isPhysioConnectCoupon?.couponName
        }).populate('transactionId');


        return res.status(200).json({
            message: "Single physio",
            status: 200,
            success: true,
            data: physio,
            invoiceData: fetchedInvoice,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false,
            error: error.message
        });
    }
};
exports.physioConnectById = async (req, res) => {
    try {
        let id = req.query.PhysioId;

        if (!id) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(id).populate({
            path: 'subscriptionId',
            select: 'planId',
            populate: {
                path: 'planId',
                model: 'Plan',
                select: 'planType'
            }
        });

        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        // Return Temporary Invoice
        const fetchedInvoice = await invoice.findOne({
            physioId: id,
            type: "subscription",
            subscriptionId: null,
            couponName: physio.isPhysioConnectCoupon?.couponName
        }).populate('transactionId');


        return res.status(200).json({
            message: "Single physio",
            status: 200,
            success: true,
            data: physio,
            invoiceData: fetchedInvoice,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false,
            error: error.message
        });
    }
};
exports.getInvoiceByPhysioId = async (req, res) => {
    try {
        let id = req.query.PhysioId;

        if (!id) {
            return res.status(400).json({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        const physio = await physioConnect.findById(id).populate({
            path: 'subscriptionId',
            select: 'planId',
            populate: {
                path: 'planId',
                model: 'Plan',
                select: 'planType'
            }
        });

        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        // Return Temporary Invoice
        const fetchedInvoice = await invoice.findOne({
            physioId: id,
            type: "subscription",
            subscriptionId: null,
            couponName: physio.isPhysioConnectCoupon?.couponName
        }).populate('transactionId');


        return res.status(200).json({
            message: "Single physio",
            status: 200,
            success: true,
            physioData: physio,
            invoiceData: fetchedInvoice,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

/**
 * Retrieves a summary of physiotherapists categorized by their subscription type.
 * 
 * This function performs an aggregation query to count the number of physiotherapists
 * who are on free plans versus paid plans. It looks up subscription and plan information
 * to determine the categorization.
 * 
 * @api GET /api/admin/physio/getAllPhysiosSummary
 * @apiDescription Get summary of physiotherapists categorized by subscription type
 * 
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response containing:
 *   - message: Status message
 *   - status: HTTP status code
 *   - success: Boolean indicating success/failure
 *   - data: Object containing:
 *     - freePhysios: Number of physiotherapists on free plans
 *     - paidPhysios: Number of physiotherapists on paid plans
 * @throws {Error} Returns a 500 status code with error message if the operation fails
 */
exports.getAllPhysiosSummary = async (req, res) => {
    try {
        const physios = await Physio.aggregate([
            {
                $match: {
                    isDeleted: false
                }
            },
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            { $unwind: { path: '$subscription', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: null,
                    free: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $eq: ['$plan.planType', 0] },
                                        { $not: ['$plan.planType'] } // covers undefined/null
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    standard: {
                        $sum: { $cond: [{ $eq: ['$plan.planType', 1] }, 1, 0] }
                    },
                    premium: {
                        $sum: { $cond: [{ $eq: ['$plan.planType', 2] }, 1, 0] }
                    }
                }
            }
        ]);

        const {
            free = 0,
            standard = 0,
            premium = 0
        } = physios[0] || {};

        return res.status(200).json({
            message: 'All physios summary',
            status: 200,
            success: true,
            data: {
                free: free,
                standard: standard,
                premium: premium
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Something went wrong. Please try again.',
            status: 500,
            success: false,
            error: error.message
        });
    }
};


exports.getPhysioConnectSummary = async (req, res) => {
    try {
        let query = { isDeleted: false, isBlocked: false, isPhysioConnect: true }

        const startOfDayIST = moment.tz(new Date(), 'Asia/Kolkata').startOf('day');
        const endOfDayIST = moment.tz(new Date(), 'Asia/Kolkata').endOf('day');
        const startUTC = new Date(startOfDayIST.toISOString());
        const endUTC = new Date(endOfDayIST.toISOString());
        const today = { $gte: startUTC, $lte: endUTC };

        // Get Total Paid/Unpaid Physio Connect
        const totalPhysioConnect = await physioConnect.countDocuments(query);
        const totalPaidPhysioConnect = await physioConnect.countDocuments({ ...query, isPhysioConnectPaid: true });
        const totalPendingPhysioConnect = await physioConnect.countDocuments({ ...query, isPhysioConnectPaid: false });

        // Get Today Paid/Unpaid Physio Connect
        const todayPaidPhysioConnect = await physioConnect.countDocuments({ ...query, isPhysioConnectPaid: true, isPhysioConnectPaidDate: today });
        const todayPendingPhysioConnect = await physioConnect.countDocuments({ ...query, isPhysioConnectPaid: false, createdAt: today });
        return res.status(200).json({
            message: 'Physio Connect summary',
            status: 200,
            success: true,
            data: {
                totalPhysioConnect,
                totalPaidPhysioConnect,
                totalPendingPhysioConnect,
                todayPaidPhysioConnect,
                todayPendingPhysioConnect
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Something went wrong. Please try again.',
            status: 500,
            success: false,
            error: error.message
        });
    }
}


// Create physio
exports.createPhysio = async (req, res) => {
    try {
        const physio = await Physio.findOne({
            phone: `+91${req.body.phone}`
        })

        let preferId = 0;
        let unique = false;
        while (!unique) {
            preferId = generateUnique6CharID();
            const check = await Physio.findOne({
                preferId: preferId
            });
            if (!check) {
                unique = true;
            }
        }

        if (physio) {
            return res.status(400).json({
                message: 'Phone number already registered',
                status: 400,
                success: false
            });
        }

        const uniqueId = new mongoose.Types.ObjectId().toString();
        const nameSlug = req.body.fullName.toLowerCase();
        let slug = `${nameSlug}-${uniqueId}`;

        const existingPhysio = await Physio.findOne({ slug });

        if (existingPhysio) {
            slug = existingPhysio.slug
            console.log('slug is already present' + slug);
        }

        const updatedPhysio = new Physio(
            {
                onboardedFrom: "web",
                preferId: preferId,
                slug: slug,
                phone: `+91${req.body.phone}` || null,
                zipCode: req.body.zipCode,
                profileImage: req.body.profileImage || null,
                fullName: req.body.fullName || null,
                email: req.body.email || null,
                about: req.body.about || null,
                treatedPatient: req.body.treatedPatients || [],
                bptDegree: {
                    degreeId: req.body.bptDegreeId || null,
                    image: req.body.bptDegreeImage || null
                },
                mptDegree: {
                    degreeId: req.body.mptDegreeId || null,
                    image: req.body.mptDegreeImage || null
                },
                specialization: req.body.specialization
                    ? (Array.isArray(req.body.specialization)
                        ? req.body.specialization.filter(id => isValidObjectId(id))
                        : req.body.specialization.split(',').map(id => id.trim()).filter(id => isValidObjectId(id)))
                    : [],
                subspecializationId: req.body.subspecialization
                    ? (Array.isArray(req.body.subspecialization)
                        ? req.body.subspecialization.filter(id => isValidObjectId(id))
                        : req.body.subspecialization.split(',').map(id => id.trim()).filter(id => isValidObjectId(id)))
                    : [],
                workExperience: Number(req.body.workExperience) || null,
                iapMember: parseInt(req.body.iapMember) || null,
                iapNumber: req.body.iapNumber || null,
                iapImage: req.body.iapImage || null,
                country: req.body.country?.toLowerCase() || null,
                state: req.body.state?.toLowerCase() || null,
                city: req.body.city?.toLowerCase() || null,
                home: {
                    status: 0,
                    workingDays: req.body.homeWorkingDays
                        ? (Array.isArray(req.body.homeWorkingDays)
                            ? req.body.homeWorkingDays.filter(day => day)
                            : req.body.homeWorkingDays.split(',').map(day => day.trim()).filter(day => day))
                        : [],
                    charges: parseInt(req.body.homeCharges),
                },
                latitude: req.body.latitude || null,
                longitude: req.body.longitude || null,
                gender: req.body.gender || null,
                language: req.body.language || null,
                treatedPatient: req.body.treatedPatients || null

            },
        )
        const savedPhysio = await updatedPhysio.save()

        const data = {
            physioId: savedPhysio._id,
            title: `New Physio ${savedPhysio.fullName} Added`,
            body: `A new physio has been added to the system.`,
            type: 'onboarding',
            from: 'admin',
            to: 'physio',
            for: 'physio'
        }

        // Save Notification For Admin
        await sendFCMNotification("Token Placeholder", data, true)

        return res.status(200).json({
            message: 'Profile updated successfully',
            status: true,
            success: true,
            data: savedPhysio
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong Please try again",
            status: 500,
            success: false
        });
    }
}

// Physio account status update
exports.updatePhysioAccountStatus = async (req, res) => {
    try {
        const { accountStatus, physioId } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400,
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404,
            });
        }
        // Update account status and slug

        const uniqueId = physioId.toString();
        const nameSlug = physio.fullName.toLowerCase();
        let slug = `${nameSlug}-${uniqueId}`;

        const existingPhysio = await Physio.findOne({ slug });
        if (existingPhysio) {
            slug = existingPhysio.slug
            console.log('slug is already present' + slug);
        }
        const updatedPhysio = await Physio.findByIdAndUpdate(
            physioId,
            {
                accountStatus: parseInt(accountStatus),
                isDeleted: false,
                slug: slug
            },
            { new: true }
        ).populate({
            path: 'subscriptionId',
            populate: {
                path: 'planId',
                model: 'Plan'
            }
        });

        // Start Physio Subscription
        const subscription = await Subscription.findById(physio.subscriptionId).populate("planId");

        if (
            subscription &&
            subscription.startAt === null &&
            physio.accountStatus === 0
        ) {
            await Subscription.findByIdAndUpdate(
                subscription._id,
                {
                    startAt: moment().toDate(),
                    expireAt: moment().add(subscription.planId.planMonth, 'months').toDate()
                }
            );
        }

        // Send notification to physio
        if (physio) {
            const data = {
                physioId: physio._id.toString(),
                title: 'Account Status Updated',
                body: `Your account status has been updated to ${accountStatus === 1 ? 'Active' : 'Inactive'}.`,
                type: 'other',
                from: 'admin',
                to: 'physio',
                for: 'physio',
            }

            const result = await sendFCMNotification(physio.deviceId, data)
            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }
        }

        return res.status(200).json({
            message: "Account status and slug updated successfully",
            status: true,
            success: true,
            updatedPhysio,
        });
    } catch (error) {
        console.error('Error updating account status and slug:', error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
        });
    }
};


exports.AllPhysioBefore = async (req, res) => {
    try {
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        // console.log(sixMonthsAgo)

        // console.log(currentDate)

        // Aggregation pipeline to filter Physios by date and extract year, month, date, and time
        const usersCountByDateTime = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
            {
                $project: {
                    createdAtDate: { $toDate: "$createdAt" }, // Convert createdAt to Date format
                }
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" }, // Extract year
                    month: { $month: "$createdAtDate" }, // Extract month
                    date: { $dayOfMonth: "$createdAtDate" }, // Extract date
                    time: {
                        $dateToString: { format: "%H:%M:%S", date: "$createdAtDate" } // Extract time in HH:mm:ss format
                    }
                }
            },
            {
                $group: {
                    _id: { year: "$year", month: "$month" }, // Group by year, month, date, and time , time: "$time", , date: "$date" 
                    count: { $sum: 1 } // Count the number of Physios in each group
                }
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 } // Sort by year, month, date, and time in descending order , "_id.time": -1 , "_id.date": -1
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    // date: "$_id.date",
                    // time: "$_id.time",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
                            ],
                            { $subtract: ["$_id.month", 1] } // Convert month number to month name
                        ]
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: usersCountByDateTime,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Inactive Physio count and Inactive Physio count before 6 month
exports.InactivePhysioCounts = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        // Query to get active physios (updated within last 3 months)
        const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        const activePhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        //  Query to get total physios created within the last 6 months
        //  const totalPhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPhysioCount" // Count the total number of physios
        //     }
        // ]);

        // Query to get active physios (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePhysioCount" // Count the number of active physios
        //     }
        // ]);

        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysio,
            activePhysio
        });

    } catch (error) {
        console.error("Error while processing physio counts:", error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// payment padi physio
exports.physioPayment = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        // Find physios created within the last 6 months
        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
                }
            }
        ]);

        // Get the count of physios created within the last 6 months
        const totalPhysioCount = await Physio.countDocuments({
            accountStatus: 1,
            isBlocked: false,
            createdAt: { $gte: sixMonthsAgo, $lte: currentDate },
        });


        const physioTransactions = await Transaction.aggregate([
            {
                $match: {
                    physioTransactionType: 0,
                    isBlocked: false,
                    physioId: { $in: totalPhysio.map((physio) => physio._id) },
                },
            },
            {
                $group: {
                    _id: "$physioId",
                    transactionCount: { $count: {} }, // Count transactions per physio
                },
            },
            {
                $project: {
                    physioId: "$_id",
                    transactionCount: 1,
                    _id: 0,
                },
            },
        ]);

        // console.log(physioTransactions, "physioTransactions");

        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysioCount,
            physioTransactions
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
};

// state physio count
exports.getPhysioCountByState = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering


        // Aggregation pipeline to count Physios by clinic.state
        const physioCountByState = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
                }
            },
            // {
            //     $unwind: "$clinic" // Unwind the clinic array to work with each clinic separately
            // },
            {
                $group: {
                    _id: "$state", // Group by clinic.state
                    count: { $sum: 1 } // Count the number of Physios in each state
                }
            },
            {
                $sort: { count: -1 } // Sort by count in descending order
            }
        ]);

        res.status(200).json({
            success: true,
            data: physioCountByState,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// ==================== state physio filter date and time ===================
exports.physioGetState = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        let state = req.query.state;
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        // Aggregation pipeline to filter users by date
        const usersCountByMonth = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state, // Filter by state
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
            {
                $project: {
                    // Convert createdAt to Date (if not already in Date format)
                    createdAtDate: { $toDate: "$createdAt" },
                }
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" },
                    month: { $month: "$createdAtDate" },
                }
            },
            {
                $group: {
                    _id: { year: "$year", month: "$month" }, // Group by year and month
                    count: { $sum: 1 } // Count the number of users in each group
                }
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 } // Sort by year and month in descending order
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
                            ],
                            { $subtract: ["$_id.month", 1] } // Convert month number to month name
                        ]
                    }
                }
            }
        ]);

        res.status(200).json({
            message: "Physio Data successfully",
            success: true,
            status: 200,
            data: usersCountByMonth,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Inactive Physio count and Inactive Physio count before  month
exports.InactivePhysioCountsState = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        // Query to get active physios (updated within last 3 months)
        const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const planName = ['Paid Plan', 'Paid Plan2'];
        let state = req.query.state;
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        const physios = await Physio.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            {
                $unwind: '$subscription'
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            {
                $unwind: '$plan'
            },
            {
                $match: {
                    'plan.name': { $in: planName },
                    'state': state,
                    'isBlocked': false,
                    'accountStatus': 1
                }
            },
            {
                $project: {
                    fullName: 1,
                    phone: 1,
                    'clinic.zipCode': 1,
                    'home.zipCode': 1,
                    serviceType: 1,
                }
            }
        ]);

        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        const activePhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state,
                    updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        //  Query to get total physios created within the last 6 months
        //  const totalPhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPhysioCount" // Count the total number of physios
        //     }
        // ]);

        // Query to get active physios (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePhysioCount" // Count the number of active physios
        //     }
        // ]);

        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysio: physios,
            activePhysio
        });

    } catch (error) {
        console.error("Error while processing physio counts:", error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// payment padi physio
exports.physioPaymentState = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        let state = req.query.state;
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        const planName = 'Free Plan';

        const physios = await Physio.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            {
                $unwind: {
                    path: '$subscription',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            {
                $unwind: {
                    path: '$plan',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $or: [
                        { 'plan.name': planName },
                        { subscriptionId: null }
                    ],
                    'state': state,
                    'isBlocked': false
                }
            },
            {
                $project: {
                    fullName: 1,
                    phone: 1,
                    'clinic.zipCode': 1,
                    'home.zipCode': 1,
                    serviceType: 1,
                }
            }
        ]);



        // Find physios created within the last 6 months
        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
                }
            }
        ]);

        // Get the count of physios created within the last 6 months
        const totalPhysioCount = await Physio.countDocuments({
            accountStatus: 1,
            isBlocked: false,
            state: state,
            createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
        });


        const physioTransactions = await Transaction.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    physioTransactionType: 0,
                    physioId: { $in: totalPhysio.map((physio) => physio._id) },
                },
            },
            {
                $group: {
                    _id: "$physioId",
                    transactionCount: { $count: {} }, // Count transactions per physio
                },
            },
            {
                $project: {
                    physioId: "$_id",
                    transactionCount: 1,
                    _id: 0,
                },
            },
        ]);

        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysioCount: physios.length,
            physioTransactions
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
};

// city physio count 
exports.getPhysioCountByCity = async (req, res) => {
    try {
        let state = req.query.state;
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        const physioCountByState = await Physio.aggregate([
            {
                $match: {
                    isBlocked: false,
                    state: state
                }
            },
            {
                $group: {
                    _id: "$city",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.status(200).json({
            message: "Physio Data successfully",
            success: true,
            status: 200,
            data: physioCountByState,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};


// ==================================== city =========================================
exports.physioGetStateAndCity = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        let state = req.query.state;
        let city = req.query.city;

        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }



        // Aggregation pipeline to filter users by date
        const usersCountByMonth = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state, // Filter by state
                    city: city, // Filter by city
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
            {
                $project: {
                    // Convert createdAt to Date (if not already in Date format)
                    createdAtDate: { $toDate: "$createdAt" },
                }
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" },
                    month: { $month: "$createdAtDate" },
                }
            },
            {
                $group: {
                    _id: { year: "$year", month: "$month" }, // Group by year and month
                    count: { $sum: 1 } // Count the number of users in each group
                }
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 } // Sort by year and month in descending order
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
                            ],
                            { $subtract: ["$_id.month", 1] } // Convert month number to month name
                        ]
                    }
                }
            }
        ]);

        // console.log(usersCountByMonth);

        res.status(200).json({
            message: "Physio Data successfully",
            success: true,
            status: 200,
            data: usersCountByMonth,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Inactive Physio count and Inactive Physio count before  month
exports.InactivePhysioCountsStateAndCity = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        // Query to get active physios (updated within last 3 months)
        const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        let state = req.query.state;
        let city = req.query.city;

        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }

        const planName = ['Paid Plan', 'Paid Plan2'];

        const physios = await Physio.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            {
                $unwind: '$subscription'
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            {
                $unwind: '$plan'
            },
            {
                $match: {
                    'plan.name': { $in: planName },
                    'state': state,
                    'city': city,
                    'isBlocked': false,
                    'accountStatus': 1
                }
            },
            {
                $project: {
                    fullName: 1,
                    phone: 1,
                    'clinic.zipCode': 1,
                    'home.zipCode': 1,
                    serviceType: 1,
                }
            }
        ]);

        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state,
                    city: city,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        const activePhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state,
                    city: city,
                    updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by createdAt range
                }
            },
        ])

        //  Query to get total physios created within the last 6 months
        //  const totalPhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPhysioCount" // Count the total number of physios
        //     }
        // ]);

        // Query to get active physios (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePhysioCount" // Count the number of active physios
        //     }
        // ]);

        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysio: physios,
            activePhysio
        });

    } catch (error) {
        console.error("Error while processing physio counts:", error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// payment padi physio
exports.physioPaymentStateAndCity = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        let state = req.query.state;
        let city = req.query.city;

        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }

        const planName = 'Free Plan';

        const physios = await Physio.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            {
                $unwind: {
                    path: '$subscription',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            {
                $unwind: {
                    path: '$plan',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $or: [
                        { 'plan.name': planName },
                        { subscriptionId: null }
                    ],
                    'state': state,
                    'city': city,
                    'isBlocked': false
                }
            },
            {
                $project: {
                    fullName: 1,
                    phone: 1,
                    'clinic.zipCode': 1,
                    'home.zipCode': 1,
                    serviceType: 1,
                }
            }
        ]);



        // Find physios created within the last 6 months
        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state: state,
                    city: city,
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }
                }
            }
        ]);


        // Get the count of physios created within the last 6 months
        const totalPhysioCount = await Physio.countDocuments({
            accountStatus: 1,
            state: state,
            city: city,
            createdAt: { $gte: sixMonthsAgo, $lte: currentDate },
        });


        const physioTransactions = await Transaction.aggregate([
            {
                $match: {
                    physioTransactionType: 0,
                    isBlocked: false,
                    physioId: { $in: totalPhysio.map((physio) => physio._id) },
                },
            },
            {
                $group: {
                    _id: "$physioId",
                    transactionCount: { $count: {} }, // Count transactions per physio
                },
            },
            {
                $project: {
                    physioId: "$_id",
                    transactionCount: 1,
                    _id: 0,
                },
            },
        ]);



        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysioCount: physios.length,
            physioTransactions
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
};

// city physio count 
exports.getPhysioCountByPinCode = async (req, res) => {
    try {

        const { state, city } = req.query;

        // Validate required fields
        if (!state) {
            return res.status(400).json({
                message: 'Please provide a state',
                success: false,
                status: 400
            });
        }

        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }
        const physioCountByZipCode = await Physio.aggregate([
            {
                $match: {
                    state: state,
                    city: city,
                    isBlocked: false,
                    isDeleted: false,
                    zipCode: { $ne: null } // make sure zipCode is present
                }
            },
            {
                $group: {
                    _id: "$zipCode",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.status(200).json({
            message: "Physio Data successfully retrieved",
            success: true,
            status: 200,
            state,
            city,
            data: physioCountByZipCode,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// =============================== Pincode =============================
exports.physioGetStateAndCityAndPincode = async (req, res) => {
    try {
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').toISOString();
        const currentDate = moment().tz('Asia/Kolkata').endOf('day').toISOString();

        const { state, city, serviceType, zipCode } = req.query;

        // Validate required fields
        if (!state || !city || !serviceType || !zipCode) {
            return res.status(400).json({
                message: 'Please provide state, city, serviceType, and zipCode for filtering',
                success: false,
                status: 400,
            });
        }



        // Determine the zipCode field based on serviceType
        const zipCodeField = serviceType === 'clinic' ? 'clinic.zipCode' : 'home.zipCode';

        // return res.json({
        //     state: state,
        //     city: city,
        //     serviceType: serviceType,
        //     zipCode: parseInt(zipCode),
        //     zipCodeField
        // })

        // Aggregation pipeline 
        const usersCountByMonth = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state,
                    city,
                    // [zipCodeField]: parseInt(zipCode), // Dynamically match based on zipCodeField
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }, // Filter by createdAt range
                },
            },
            {
                $project: {
                    createdAtDate: { $toDate: "$createdAt" }, // Ensure createdAt is treated as a Date
                },
            },
            {
                $project: {
                    year: { $year: "$createdAtDate" },
                    month: { $month: "$createdAtDate" },
                },
            },
            {
                $group: {
                    _id: { year: "$year", month: "$month" }, // Group by year and month
                    count: { $sum: 1 }, // Count the number of users in each group
                },
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 }, // Sort by year and month in descending order
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    count: 1,
                    monthName: {
                        $arrayElemAt: [
                            [
                                "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
                            ],
                            { $subtract: ["$_id.month", 1] }, // Convert month number to month name
                        ],
                    },
                },
            },
        ]);

        res.status(200).json({
            message: "Physio Data retrieved successfully",
            success: true,
            status: 200,
            data: usersCountByMonth,
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// Inactive Physio count and Inactive Physio count before  month
exports.InactivePhysioCountsStateAndCityAndPincode = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') // Current date for filtering

        // Query to get active physios (updated within last 3 months)
        const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        const { state, city, serviceType, zipCode } = req.query;

        // Validate required fields
        if (!state || !city || !serviceType || !zipCode) {
            return res.status(400).json({
                message: 'Please provide state, city, serviceType, and zipCode for filtering',
                success: false,
                status: 400,
            });
        }

        // Determine the zipCode field based on serviceType
        const zipCodeField = serviceType === 'clinic' ? 'clinic.zipCode' : 'home.zipCode';


        const planName = ['Paid Plan', 'Paid Plan2'];

        const physios = await Physio.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            {
                $unwind: '$subscription'
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            {
                $unwind: '$plan'
            },
            {
                $match: {
                    'plan.name': { $in: planName },
                    'state': state,
                    'city': city,
                    'isBlocked': false,
                    'accountStatus': 1,
                    // [zipCodeField]: parseInt(zipCode),
                }
            },
            {
                $project: {
                    fullName: 1,
                    phone: 1,
                    'clinic.zipCode': 1,
                    'home.zipCode': 1,
                    serviceType: 1,
                }
            }
        ]);


        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state,
                    city,
                    [zipCodeField]: parseInt(zipCode), // Dynamically match based on zipCodeField
                },
            },
        ])

        const activePhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state,
                    city,
                    // [zipCodeField]: parseInt(zipCode), // Dynamically match based on zipCodeField
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }, // Filter by createdAt range
                },
            },
        ])

        //  Query to get total physios created within the last 6 months
        //  const totalPhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             createdAt: { $gte: sixMonthsAgo, $lte: currentDate } // Filter by createdAt range
        //         }
        //     },
        //     {
        //         $count: "totalPhysioCount" // Count the total number of physios
        //     }
        // ]);

        // Query to get active physios (updated within last 3 months)
        // const threeMonthAgo = moment().tz('Asia/Kolkata').subtract(3, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        // const activePhysio = await Physio.aggregate([
        //     {
        //         $match: {
        //             updatedAt: { $gte: threeMonthAgo, $lte: currentDate } // Filter by updatedAt range
        //         }
        //     },
        //     {
        //         $count: "activePhysioCount" // Count the number of active physios
        //     }
        // ]);

        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysio: physios,
            activePhysio
        });

    } catch (error) {
        console.error("Error while processing physio counts:", error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// payment padi physio
exports.physioPaymentStateAndCityAndPincode = async (req, res) => {
    try {
        // Calculate the date six months before the current date in IST
        const sixMonthsAgo = moment().tz('Asia/Kolkata').subtract(6, 'months').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        const currentDate = moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'); // Current date for filtering

        const { state, city, serviceType, zipCode } = req.query;

        // Validate required fields
        if (!state || !city || !serviceType || !zipCode) {
            return res.status(400).json({
                message: 'Please provide state, city, serviceType, and zipCode for filtering',
                success: false,
                status: 400,
            });
        }

        // Determine the zipCode field based on serviceType
        const zipCodeField = serviceType === 'clinic' ? 'clinic.zipCode' : 'home.zipCode';


        if (!city) {
            return res.status(400).json({
                message: 'Please provide a city',
                success: false,
                status: 400
            });
        }



        // Find physios created within the last 6 months
        const totalPhysio = await Physio.aggregate([
            {
                $match: {
                    accountStatus: 1,
                    isBlocked: false,
                    state,
                    city,
                    [zipCodeField]: parseInt(zipCode), // Dynamically match based on zipCodeField
                    createdAt: { $gte: sixMonthsAgo, $lte: currentDate }, // Filter by createdAt range
                },
            }
        ]);


        // Get the count of physios created within the last 6 months
        const totalPhysioCount = await Physio.countDocuments({
            accountStatus: 1,
            isBlocked: false,
            state,
            city,
            [zipCodeField]: parseInt(zipCode), // Dynamically match based on zipCodeField
            createdAt: { $gte: sixMonthsAgo, $lte: currentDate },
        });


        const physioTransactions = await Transaction.aggregate([
            {
                $match: {
                    physioTransactionType: 0,
                    physioId: { $in: totalPhysio.map((physio) => physio._id) },
                },
            },
            {
                $group: {
                    _id: "$physioId",
                    transactionCount: { $count: {} }, // Count transactions per physio
                },
            },
            {
                $project: {
                    physioId: "$_id",
                    transactionCount: 1,
                    _id: 0,
                },
            },
        ]);



        return res.status(200).json({
            message: "Physio Data successfully",
            status: 200,
            success: true,
            totalPhysioCount,
            physioTransactions
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
};


exports.getPhysioCountByPincodeByPhysio = async (req, res) => {
    try {
        const { state, city, zipCode } = req.query;

        // Validate required fields
        if (!state || !city || !zipCode) {
            return res.status(400).json({
                message: 'Please provide state, city, and zipCode for filtering',
                success: false,
                status: 400,
            });
        }

        const physioCountByState = await Physio.aggregate([
            {
                $match: {
                    isDeleted: false,
                    isBlocked: false,
                    state: state,
                    city: city,
                    zipCode: zipCode // assuming zipCode is a string
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);


        res.status(200).json({
            message: "Physio Data successfully",
            success: true,
            status: 200,
            data: physioCountByState,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};



// Get physio  Today Appointment
exports.getPhysioByTodayAppointment = async (req, res) => {
    try {

        const physioId = req.body.PhysioId
        if (!physioId) {
            return res.status(400).json({
                message: 'Please provide physioId',
                success: false,
                status: 400,
            });
        }

        // if check Physio
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: 'Please provide physioId',
                success: false,
                status: 400,
            });
        }

        // current date
        let toDay = moment().startOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        let toDayEnd = moment().endOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        const appointments = await Appointment.find({
            physioId: physioId,

            appointmentDate: {
                $gte: toDay,
                $lte: toDayEnd

            }
        }).populate('physioId');


        if (!appointments) {
            return res.status(400).json({
                message: 'Appointment not found',
                success: false,
                status: 400,
            });
        }

        return res.status(200).json({
            message: "Physio Data successfully",
            success: true,
            status: 200,
            data: appointments
        });



    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Semething went wrong. Please try again.",
            status: 500,
            success: false,
        })
    }
}

// physio by Get Appointment 
exports.getPhysioByGetAppointment = async (req, res) => {
    try {

        const { physioId, serviceType, appointmentStatus } = req.query;

        // Validate physioId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid physioId format',
                success: false,
                status: 400
            });
        }

        // console.log("physioId", physioId);
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        // Special case when appointmentStatus is 25
        if (appointmentStatus == 25) {
            const appointments = await Appointment.find({
                physioId,
                appointmentCompleted: true
            }).populate('patientId physioId')
                .populate({
                    path: 'physioId',
                    populate: {
                        path: 'specialization',
                        model: 'Specialization'
                    }
                })


            return res.status(200).json({
                message: 'Appointments fetched',
                success: true,
                status: 200,
                data: appointments
            });
        }

        // Build the query dynamically
        const query = { physioId };

        if (serviceType) {
            query.serviceType = Number(serviceType);
        }

        if (appointmentStatus) {
            query.appointmentStatus = Number(appointmentStatus);
        }

        // Fetch appointments based on constructed query
        const appointments = await Appointment.find(query)
            .populate('patientId physioId')
            .populate({
                path: 'physioId',
                populate: {
                    path: 'specialization',
                    model: 'Specialization'
                }
            })
        return res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: appointments
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// Get Physio And Patient Chat
exports.getPhysioAndPatientChat = async (req, res) => {
    try {

        const { physioId, patientId } = req.query;
        // Validate physioId and patientId as valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId) || !mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({
                message: 'Invalid physioId or patientId format',
                success: false,
                status: 400
            });
        }

        // Fetch chat history between physio and patient
        const chatHistory = await Chat.find({
            $and: [
                physioId,
                patientId
            ]
        });
        if (!chatHistory) {
            return res.status(404).json({
                message: 'No chat history found',
                success: false,
                status: 404
            });
        }

        return res.status(200).json({
            message: 'Chat history fetched',
            success: true,
            status: 200,
            data: chatHistory
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
}

// Get today Appointment
exports.getTodayAppointment = async (req, res) => {
    try {

        // curent date
        let toDay = moment().startOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');
        let toDayEnd = moment().endOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS');

        let physioId = req.query.physioId;
        if (!physioId) {
            return res.status(400).json({
                message: 'Please provide physioId',
                success: false,
                status: 400,
            });
        }
        const appointments = await Appointment.find({
            physioId,
            date: {
                $gte: toDay,
                $lte: toDayEnd
            }
        }).populate('patientId physioId')
            .populate({
                path: 'physioId',
                populate: {
                    path: 'specialization',
                    model: 'Specialization'
                }
            })

        return res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: appointments
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
}

// Get Review Bzy Physio
exports.getReviewByPhysio = async (req, res) => {
    try {
        const { physioId, patientId } = req.query;

        // Validate physioId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid physioId format',
                success: false,
                status: 400
            });
        }

        // Validate patientId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({
                message: 'Invalid patientId format',
                success: false,
                status: 400
            });
        }

        // Fetch reviews for the given physio
        const reviews = await Review.find({ physioId, patientId }).populate('patientId');
        if (!reviews) {
            return res.status(404).json({
                message: 'No reviews found for this physio',
                success: false,
                status: 404
            });
        }

        return res.status(200).json({
            message: 'Reviews fetched',
            success: true,
            status: 200,
            data: reviews
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
};


// Physio Subscription
exports.physioSubscription = async (req, res) => {
    try {
        const { physioId } = req.query;
        // Validate physioId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid physioId format',
                success: false,
                status: 400
            });
        }
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        const subscription = await Subscription.find({ physioId }).populate("couponId planId")
        // .populate({
        //     path: 'couponId',
        //     populate: {
        //         path: 'planId',
        //         model: 'Plan'
        //     }
        // })
        if (!subscription) {
            return res.status(404).json({
                message: 'Subscription not found',
                success: false,
                status: 404
            });
        }

        return res.status(200).json({
            message: 'Subscription fetched',
            success: true,
            status: 200,
            data: subscription
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false,
            error: error
        });
    }
};


// get physio by subscription paid
exports.getPhysioBySubscription = async (req, res) => {
    try {
        const planName = ['Paid Plan', 'Paid Plan2'];
        const { date } = req.query;

        // console.log(date)

        // Calculate start and end of day if date is provided
        let dateMatch = {};
        if (date) {
            const startOfDay = moment(date).startOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            const endOfDay = moment(date).endOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            dateMatch = {
                'createdAt': { $gte: startOfDay, $lte: endOfDay }
            };
        }

        const physios = await Physio.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription',
                    pipeline: [
                        { $project: { planId: 1, startDate: 1 } } // Limit fields from subscription
                    ]
                }
            },
            {
                $unwind: '$subscription'
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan',
                    pipeline: [
                        { $project: { name: 1 } } // Limit fields from plans
                    ]
                }
            },
            {
                $unwind: '$plan'
            },
            {
                $match: {
                    'isBlocked': false,
                    'accountStatus': 1,
                    'plan.name': { $in: planName },
                    ...dateMatch // Add date filter if present
                }
            },
            {
                $project: {
                    fullName: 1,
                    phone: 1,
                    'clinic.zipCode': 1,
                    'home.zipCode': 1,
                    serviceType: 1,
                }
            }
        ]);

        return res.status(200).json({
            message: 'Physiotherapists with the given plan name fetched successfully',
            success: true,
            status: 200,
            paidPhysioCount: physios.length,
            data: physios
        });
    } catch (error) {
        console.error('Error fetching physiotherapists:', error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
};


// Get Physio By Subscription Not Paid
exports.getPhysioBySubscriptionNotPaid = async (req, res) => {
    try {
        const planName = 'Free Plan';

        const physios = await Physio.aggregate([
            {
                $lookup: {
                    from: 'subscriptions',
                    localField: 'subscriptionId',
                    foreignField: '_id',
                    as: 'subscription'
                }
            },
            {
                $unwind: {
                    path: '$subscription',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'subscription.planId',
                    foreignField: '_id',
                    as: 'plan'
                }
            },
            {
                $unwind: {
                    path: '$plan',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $or: [
                        { 'plan.name': planName },
                        { subscriptionId: null }
                    ],
                    'isBlocked': false,
                }
            },
            {
                $project: {
                    fullName: 1,
                    phone: 1,
                    'clinic.zipCode': 1,
                    'home.zipCode': 1,
                    serviceType: 1,
                }
            }
        ]);

        return res.status(200).json({
            message: 'Physiotherapists with the given plan name or no subscription ID fetched successfully',
            success: true,
            status: 200,
            notPaidPhysioCount: physios.length,
            data: physios
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false
        });
    }
};


exports.addSubscriptionPlan = async (req, res) => {
    try {
        const { physioId, planId, amount } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                status: 400,
                success: false,
            });
        }

        if (!planId) {
            return res.status(400).json({
                message: "planId is required",
                status: 400,
                success: false,
            });
        }


        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: "physio not found",
                status: 400,
                success: false,
            });
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(400).json({
                message: "plan not found",
                status: 400,
                success: false,
            });
        }

        const physioAccountStatus = physio.accountStatus;

        // Subscription
        const subscription = Subscription({
            physioId: physio._id,
            planId: plan._id,
            amount: amount,
            patientLimit: plan.patientLimit || 0,
            // startAt: physioAccountStatus === 1 ? moment().toDate() : null,
            expireAt: moment().add(plan.planMonth, 'months').toDate()
        })

        const savedSubscription = await subscription.save();

        await Physio.findByIdAndUpdate(physioId, {
            $set: {
                subscriptionId: savedSubscription._id,
                subscriptionCount: physio.subscriptionCount + 1
            }
        });

        return res.status(200).json({
            message: "Subscription plan added successfully",
            status: 200,
            success: true,
            data: savedSubscription,
            physio
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}


exports.deletePhysioSubscriptionById = async (req, res) => {
    try {
        const { physioId, subscriptionId } = req.query;

        if (!physioId || !subscriptionId) {
            return res.status(400).json({
                message: 'physioId and subscriptionId is required',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        const subscription = await Subscription.findByIdAndDelete(subscriptionId);
        if (!subscription) {
            return res.status(404).json({
                message: 'Subscription not found',
                success: false,
                status: 404
            });
        }

        // prevent subscriptionId override on previous subscription deletion
        if (physio.subscriptionId === subscriptionId) {
            physio.subscriptionId = null;
            await physio.save();
        }

        return res.status(200).json({
            message: 'Subscription deleted successfully',
            success: true,
            status: 200
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong. Please try again.",
            status: 500,
            success: false,
            error: error
        });
    }
}


// Soft delete physio
exports.deletePhysio = async (req, res) => {
    try {
        const { physioId } = req.query;

        // Validate physioId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid physioId format',
                success: false,
                status: 400
            });
        }
        const physio = await Physio.findById(physioId);

        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        // Unapprove Physio & Soft Delete Physio
        await Physio.findByIdAndUpdate(
            physioId,
            {
                accountStatus: 0,
                isDeleted: true
            },
            { new: true }
        );

        return res.status(200).json({
            message: 'Physio deleted successfully',
            success: true,
            status: 200
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
}


// Hard delete physio
exports.purgePhysio = async (req, res) => {
    try {
        const { physioId } = req.query;

        // Validate physioId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid physioId format',
                success: false,
                status: 400
            });
        }

        // Check if physio exists
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false
            });
        }

        // // Find related data
        // const [degrees, transactions, subscriptions, reviews, notificationsData, plans] = await Promise.all([
        //     Degree.find({ physioId }),
        //     Transaction.find({ physioId }),
        //     Subscription.find({ physioId }),
        //     Review.find({ physioId }),
        //     notification.find({ physioId }),
        //     Plan.find({ physioId }),
        // ]);

        // Log all related data to console
        // console.log('Degrees:', degrees);
        // console.log('Transactions:', transactions);
        // console.log('Subscriptions:', subscriptions);
        // console.log('Reviews:', reviews);
        // console.log('Notifications:', notificationsData);
        // console.log('Plans:', plans);

        // Delete related data
        await Promise.all([
            Degree.deleteMany({ physioId }),
            Transaction.deleteMany({ physioId }),
            Subscription.deleteMany({ physioId }),
            // Appointment.deleteMany({ physioId }),
            // Chat.deleteMany({ $or: [{ senderId: physioId }, { receiverId: physioId }] }),

            Review.deleteMany({ physioId }),
            notification.deleteMany({ physioId }),
            Plan.deleteMany({ physioId }),
        ]);
        // Delete physio images
        const imagesToDelete = [];
        // IAP and Profile Images
        if (physio.iapImage) imagesToDelete.push(physio.iapImage);
        // console.log("Physioiap ", physio.iapImage);
        if (physio.profileImage) imagesToDelete.push(physio.profileImage);
        // console.log("Physioprofile ", physio.profileImage);
        // Degree images
        if (physio.degree?.degreeImage?.length) {
            imagesToDelete.push(...physio.degree.degreeImage.filter(Boolean));
        }
        // console.log("Physiodegree ", physio.degree.degreeImage);

        // Achievement images
        if (physio.achievement?.length) {
            physio.achievement.forEach(a => {
                if (a.achievementImage) imagesToDelete.push(a.achievementImage);
            });
        }
        // console.log("Physioachievment ", physio.achievement);
        // Clinic images
        if (physio.clinic?.imagesClinic?.length) {
            imagesToDelete.push(...physio.clinic.imagesClinic.filter(Boolean));
        }
        // console.log("Physioclinic ", physio.clinic.imagesClinic);
        // Step 2: Log the image URLs
        // console.log("🗑️ Images scheduled for deletion:", imagesToDelete);

        // Step 3: Delete each image from S3
        for (const imageUrl of imagesToDelete) {
            try {
                await deleteFileFromS3(imageUrl);
                console.log(`✅ Deleted from S3: ${imageUrl}`);
            } catch (error) {
                console.error(`❌ Failed to delete: ${imageUrl}`, error.message);
            }
        }

        // Finally, delete the physio
        await Physio.findByIdAndDelete(physioId);

        return res.status(200).json({
            message: 'Physio and related data deleted successfully',
            success: true
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Server error during purge',
            success: false
        });
    }
};


// physio Blocked API
exports.blockPhysio = async (req, res) => {
    try {
        const { physioId } = req.query;
        // Validate physioId as a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid physioId format',
                success: false,
                status: 400
            });
        }
        // return console.log(physioId);
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });

        }

        if (physio.isBlocked == true) {
            // isBlocked updates the false status
            physio.isBlocked = false;
            await physio.save();
            return res.status(200).json({
                message: 'Physio unblocked successfully',
                success: true,
                status: 200
            });

        } else {
            // isBlocked updates the true status
            physio.isBlocked = true;
            await physio.save();
            return res.status(200).json({
                message: 'Physio blocked successfully',
                success: true,
                status: 200
            });

        }



    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Server error',
            success: false
        });
    }
};


// get today physio
exports.getTodayPhysio = async (req, res) => {
    const { isPhysioConnect } = req.query;

    try {
        const start = moment().tz('Asia/Kolkata').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
        const end = moment().tz('Asia/Kolkata').endOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')

        const physios = await Physio.find({
            createdAt: {
                $gte: start,
                $lt: end
            },
            isPhysioConnect: isPhysioConnect == 'true'
        })

        return res.status(200).json({
            message: 'Physio scheduled for today fetched successfully',
            success: true,
            status: 200,
            data: physios
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Server error',
            success: false
        });
    }
};


// Get blocked Physio
exports.getBlockedPhysio = async (req, res) => {
    try {
        const physios = await Physio.find({
            isBlocked: true
        })

        return res.status(200).json({
            message: 'Physio blocked fetched successfully',
            success: true,
            status: 200,
            data: physios
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Server error',
            success: false,
            error
        });
    }
};


exports.getAllNotifications = async (req, res) => {
    try {
        const { tabKey } = req.query;

        if (!tabKey || tabKey.trim() === '') {
            return res.status(400).json({
                message: 'Tab key is required',
                success: false,
                status: 400
            });
        }

        // Handle the tabKey directly as a string
        if (tabKey === 'Physios') {
            const physioNotifications = await notification.find({
                "to": { $in: ['AdminPhysio'] },
            }).sort({ createdAt: -1 }).populate('patientId').populate('physioId');

            if (physioNotifications) {
                return res.status(200).json({
                    message: 'Physio notifications fetched successfully',
                    success: true,
                    status: 200,
                    data: physioNotifications
                });
            }

        } else if (tabKey === 'Patients') {
            const patientNotifications = await notification.find({
                "sender": { $in: ['AdminPatient', 'physio', 'Admin'] },
            }).sort({ createdAt: -1 }).populate('patientId').populate('physioId');

            if (patientNotifications) {
                return res.status(200).json({
                    message: 'Patient notifications fetched successfully',
                    success: true,
                    status: 200,
                    data: patientNotifications
                });
            }
        } else {
            return res.status(404).json({
                message: `No notifications found for tabKey: ${tabKey}`,
                success: false,
                status: 404,
                data: []
            });
        }

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            message: 'Server error',
            success: false,
            error
        });
    }
};


exports.getSubscriptionExpiredPhysios = async (req, res) => {
    try {
        const { expireType, onBoardedFrom } = req.query;

        if (!expireType || expireType.trim() === '') {
            return res.status(400).json({
                message: 'Expire type is required',
                success: false,
                status: 400
            });
        }

        if (!['aboutToExpire', 'expired', 'freePlanExpired'].includes(expireType)) {
            return res.status(404).json({
                message: `Invalid expireType ${expireType}. expireType can only be 'aboutToExpire', 'expired' or 'freePlanExpired'`,
                success: false,
                status: 404,
                data: []
            });
        }

        const filter = {
            isDeleted: false,
            isBlocked: false
        }

        if (onBoardedFrom) {
            filter.onboardedFrom = onBoardedFrom;
        }

        if (expireType === 'expired') {
            const expiredPhysios = await Physio.aggregate([
                {
                    $match: {
                        subscriptionId: { $eq: null },
                        subscriptionCount: { $gt: 0 },
                        ...filter
                    }
                },
                {
                    $project: {
                        _id: 1,
                        fullName: 1,
                        profileImage: 1,
                        phone: 1,
                        serviceType: 1,
                        workExperience: 1,
                        accountStatus: 1,
                        createdAt: 1,
                    }
                }
            ]);

            return res.status(200).json({
                message: 'Physios with expired subscriptions fetched successfully',
                success: true,
                status: 200,
                data: expiredPhysios
            });

        } else if (expireType === 'aboutToExpire') {
            // Physios whose subscription expires within N days
            const aboutToExpireInDays = 30;
            const expiringSoonQuery = await Physio.aggregate([
                {
                    $match: {
                        subscriptionId: { $ne: null },
                        ...filter
                    }
                },
                {
                    $lookup: {
                        from: 'subscriptions',
                        localField: 'subscriptionId',
                        foreignField: '_id',
                        as: 'subscription'
                    }
                },
                { $unwind: '$subscription' },
                {
                    $addFields: {
                        daysUntilExpiry: {
                            $divide: [
                                { $subtract: ["$subscription.expireAt", new Date()] },
                                1000 * 60 * 60 * 24
                            ]
                        }
                    }
                },
                {
                    $match: {
                        daysUntilExpiry: { $gte: 0, $lte: aboutToExpireInDays }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        fullName: 1,
                        profileImage: 1,
                        phone: 1,
                        serviceType: 1,
                        workExperience: 1,
                        accountStatus: 1,
                        createdAt: 1,
                    }
                }
            ]);

            return res.status(200).json({
                message: `Physios about to expire in ${aboutToExpireInDays} days fetched successfully`,
                success: true,
                status: 200,
                data: expiringSoonQuery
            });

        } else if (expireType === 'freePlanExpired') {
            // Physios with free plan and 4+ patients
            const freePlanLimitReachedQuery = await Physio.aggregate([
                {
                    $match: {
                        subscriptionId: { $ne: null },
                        subscriptionCount: { $gt: 0 },
                        ...filter
                    }
                },
                {
                    $lookup: {
                        from: 'subscriptions',
                        localField: 'subscriptionId',
                        foreignField: '_id',
                        as: 'subscription'
                    }
                },
                { $unwind: '$subscription' },
                {
                    $lookup: {
                        from: 'plans',
                        localField: 'subscription.planId',
                        foreignField: '_id',
                        as: 'plan'
                    }
                },
                { $unwind: '$plan' },
                {
                    $match: {
                        'plan.planType': 0,
                        'subscription.patientCount': { $gte: 4 }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        fullName: 1,
                        profileImage: 1,
                        phone: 1,
                        serviceType: 1,
                        workExperience: 1,
                        accountStatus: 1,
                        createdAt: 1,
                    }
                }
            ]);

            return res.status(200).json({
                message: 'Physios with free plan and 4+ patients fetched successfully',
                success: true,
                status: 200,
                data: freePlanLimitReachedQuery
            });

        } else {
            return res.status(404).json({
                message: `No physios found for expireType: ${expireType}`,
                success: false,
                status: 404,
                data: []
            });
        }

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            message: 'Server error',
            success: false,
            error
        });
    }
};
