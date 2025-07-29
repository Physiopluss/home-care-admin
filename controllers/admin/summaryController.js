const moment = require('moment-timezone');
const Physio = require('../../models/physio');
const Patient = require('../../models/patient');
const PhysioProfileEdit = require('../../models/physioProfileEdit');
const Transaction = require('../../models/transaction');
const Appointment = require('../../models/appointment');
const CashBack = require('../../models/cashBack');

/**
 * @api {get} /api/admin/summary/summary-state-wise
 * @apiDescription This function performs an aggregation query to count the number of physiotherapists
 * categorized by their account status (approved/pending) and grouped by state.
 * @apiParam {String} [onboardedFrom] onboarded from `mobile` or `web`
 * @apiSuccess {Object[]} summary of physios with state
 * @apiSuccessExample {json} Success-Response:
 *   [
 *     {
 *       "_id": "Maharashtra",
 *       "total": 56,
 *       "approved": 45,
 *       "pending": 11
 *     },
 *   ]
 * @apiError {String} message description of error
 * @apiErrorExample {json} Error-Response:
 *   {
 *     "message": "Something went wrong"
 *   }
 */
exports.getSummaryStateWise = async (req, res) => {
    try {

        const { onboardedFrom } = req.query;

        const filter = {
            isDeleted: false,
            isBlocked: false,
            state: { $nin: [null, ''] },  // Exclude empty and null state
            $or: [
                { isPhysioConnect: false },
                { isPhysioConnect: true, isPhysioConnectTransferred: true }, // Include those who are transferred
                { isPhysioConnectTransferred: { $exists: false } } // Include those who do not have the field
            ]
        }

        if (onboardedFrom) {
            filter.onboardedFrom = onboardedFrom;
        }

        const result = await Physio.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: '$state',
                    total: { $sum: 1 },
                    approved: {
                        $sum: {
                            $cond: [{ $eq: ['$accountStatus', 1] }, 1, 0]
                        }
                    },
                    pending: {
                        $sum: {
                            $cond: [{ $eq: ['$accountStatus', 0] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    state: '$_id',
                    total: 1,
                    approved: 1,
                    pending: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @api {get} /api/admin/summary/summary-city-wise
 * @apiDescription This function performs an aggregation query to count the number of physiotherapists
 * categorized by their account status (approved/pending) and grouped by city.
 * @apiParam {String} [onboardedFrom] onboarded from `mobile` or `web`
 * @apiSuccess {Object[]} summary of physios with city
 * @apiSuccessExample {json} Success-Response:
 *   [
 *     {
 *       "_id": "Mumbai",
 *       "total": 56,
 *       "approved": 45,
 *       "pending": 11
 *     }
 *   ]
 * @apiError {String} message description of error
 * @apiErrorExample {json} Error-Response:
 *   {
 *     "message": "Something went wrong"
 *   }
 */
exports.getSummaryCityWise = async (req, res) => {
    try {

        const { onboardedFrom } = req.query;

        const filter = {
            isDeleted: false,
            isBlocked: false,
            city: { $nin: [null, ''] },  // Exclude empty and null city
            $or: [
                { isPhysioConnect: false },
                { isPhysioConnect: true, isPhysioConnectTransferred: true }, // Include those who are transferred
                { isPhysioConnectTransferred: { $exists: false } } // Include those who do not have the field
            ]
        }

        if (onboardedFrom) {
            filter.onboardedFrom = onboardedFrom;
        }

        const result = await Physio.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: '$city',
                    total: { $sum: 1 },
                    approved: {
                        $sum: {
                            $cond: [{ $eq: ['$accountStatus', 1] }, 1, 0]
                        }
                    },
                    pending: {
                        $sum: {
                            $cond: [{ $eq: ['$accountStatus', 0] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    city: '$_id',
                    total: 1,
                    approved: 1,
                    pending: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * @api {get} /api/admin/summary/filter-physios
 * @apiDescription This function filters physiotherapists based on the provided query parameters.
 * @apiSuccess {Object[]} summary of physios with city
 * @apiSuccessExample {json} Success-Response
 * @apiError {String} message description of error
 */
exports.filterPhysios = async (req, res) => {
    try {
        const {
            state,
            city,
            accountStatus,
            date,
            fourPatient,
            onboardedFrom,
            serviceType,
            planType = 'free',
            page = 1,
            limit = 20
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const parsedLimit = parseInt(limit);

        const filter = {
            isDeleted: false,
            isBlocked: false,
            $or: [
                { isPhysioConnect: false },
                { isPhysioConnect: true, isPhysioConnectTransferred: true }, // Include those who are transferred
                { isPhysioConnectTransferred: { $exists: false } } // Include those who do not have the field
            ]
        };

        if (state) filter.state = state;
        if (city) filter.city = city;
        if (onboardedFrom) filter.onboardedFrom = onboardedFrom;
        if (accountStatus && planType === 'free') {
            filter.accountStatus = parseInt(accountStatus);
        }

        if (serviceType === 'home') {
            filter.serviceType = { $eq: 'home' };
        } else if (serviceType === 'clinic') {
            filter.serviceType = { $eq: 'clinic' };
        } else if (serviceType === 'both') {
            filter.serviceType = { $all: ['home', 'clinic'] };
        }

        if (date) {
            const startOfDayIST = moment.tz(date, 'Asia/Kolkata').startOf('day');
            const endOfDayIST = moment.tz(date, 'Asia/Kolkata').endOf('day');

            const startUTC = new Date(startOfDayIST.toISOString());
            const endUTC = new Date(endOfDayIST.toISOString());

            filter.createdAt = { $gte: startUTC, $lte: endUTC };
        }

        let planTypeMatch = {};
        if (planType === 'free') {
            planTypeMatch = {
                $or: [
                    { 'plan.planType': { $eq: 0 } },
                    { 'plan.planType': { $exists: false } }
                ]
            };
        } else if (planType === 'standard') {
            planTypeMatch = { 'plan.planType': { $eq: 1 } };
        } else if (planType === 'premium') {
            planTypeMatch = { 'plan.planType': { $eq: 2 } };
        }

        const fourPatientMatch = ['true', true].includes(fourPatient)
            ? { 'subscription.patientCount': { $gte: 4 } }
            : {};

        // Aggregation pipeline for fetching paginated physios
        const physios = await Physio.aggregate([
            { $match: filter },
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
                $lookup: {
                    from: 'physioprofileedits',
                    let: { physioId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$physioId', '$$physioId'] },
                                        { $eq: ['$status', 'pending'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'editRequests'
                }
            },
            {
                $addFields: {
                    hasEditRequest: { $gt: [{ $size: '$editRequests' }, 0] }
                }
            },
            { $match: planTypeMatch },
            { $match: fourPatientMatch },
            { $skip: skip },
            { $limit: parsedLimit },
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
                    hasEditRequest: 1,
                    "clinic.zipCode": 1,
                    "home.zipCode": 1
                }
            }
        ]);

        // Get total count for pagination
        const countAggregation = await Physio.aggregate([
            { $match: filter },
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
            { $match: planTypeMatch },
            { $match: fourPatientMatch },
            { $count: 'count' }
        ]);

        const totalCount = countAggregation[0]?.count || 0;

        // Get edit request count
        const physioIds = physios.map(p => p._id);
        const editRequestCount = await PhysioProfileEdit.countDocuments({
            physioId: { $in: physioIds }
        });

        res.status(200).json({
            success: true,
            data: {
                physios,
                totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parsedLimit),
                editRequestCount
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * @api {get} /api/admin/summary/summary-physios
 * @apiDescription Gets the stats of physios
 * @apiSuccess {Object} summary of physios
 * @apiSuccessExample {json} Success-Response:
 * {
 *   "approvedPhysioCount": 100,
 *   "pendingPhysioCount": 50,
 *   "todayPhysioCount": 5,
 *   "editRequestCount": 2,
 *   "todayEditRequestCount": 1,
 *   "withdrawalRequestCount": 3,
 *   "todayWithdrawalRequestCount": 1
 * }
 * @apiError {String} message description of error
 * @apiErrorExample {json} Error-Response:
 *   {
 *     "message": "Something went wrong"
 *   }
 */
exports.getSummaryPhysios = async (req, res) => {
    try {

        // Promise All
        const [
            approvedPhysioCount, pendingPhysioCount, todayPhysioCount,
            withdrawalRequestCount, todayWithdrawalRequestCount,
            TotalCashRepay, TodayCashRepay

        ] = await Promise.all([
            Physio.countDocuments({ isDeleted: false, isBlocked: false, accountStatus: 1 }),
            Physio.countDocuments({ isDeleted: false, isBlocked: false, accountStatus: 0 }),
            Physio.countDocuments({
                isDeleted: false,
                isBlocked: false,
                createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            }),
            Transaction.countDocuments({ physioTransactionType: 2 }),
            Transaction.countDocuments({
                physioTransactionType: 2,
                createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            }),
            Transaction.countDocuments({ paidTo: "physioPlus", paidFor: "debt" }),
            Transaction.countDocuments({
                paidTo: "physioPlus", paidFor: "debt", createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            },),
        ]);

        const data = {
            physio: {
                approvedCount: approvedPhysioCount,
                pendingCount: pendingPhysioCount,
                today: todayPhysioCount
            },
            cashRepay: {
                total: TotalCashRepay,
                today: TodayCashRepay
            },
            withdrawalRequest: {
                total: withdrawalRequestCount,
                today: todayWithdrawalRequestCount
            }
        }

        res.status(200).json({
            success: true,
            message: 'Summary data fetched successfully',
            data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * @api {get} /api/admin/summary/physio-subscription-stats
 * @apiDescription Retrieves subscription statistics for physiotherapists. This includes:
 *  - Count of physios on a free plan who have reached or exceeded the patient limit (4+ patients).
 *  - Count of physios whose subscriptions are expiring within the next 30 days.
 *  - Count of physios with no active subscription but have existing patients (i.e., expired subscriptions).
 * 
 * @apiSuccess {Object} data Object containing subscription statistics.
 * @apiError {Object} error Error object
 */
// exports.getPhysioSubscriptionStats = async (req, res) => {
//     try {
//         // 1. Count physios with free plan and 4+ patients
//         const freePlanLimitReachedQuery = Physio.aggregate([
//             {
//                 $match: {
//                     subscriptionId: { $ne: null },
//                     subscriptionCount: { $gt: 0 },
//                     isDeleted: false,
//                     isBlocked: false
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'subscriptions',
//                     localField: 'subscriptionId',
//                     foreignField: '_id',
//                     as: 'subscription'
//                 }
//             },
//             { $unwind: '$subscription' },
//             {
//                 $lookup: {
//                     from: 'plans',
//                     localField: 'subscription.planId',
//                     foreignField: '_id',
//                     as: 'plan'
//                 }
//             },
//             { $unwind: '$plan' },
//             {
//                 $match: {
//                     'plan.planType': 0,
//                     'subscription.patientCount': { $gte: 4 }
//                 }
//             },
//             { $count: 'count' }
//         ]);

//         // 2. Count physios whose subscription expires within N days
//         const aboutToExpireInDays = 30;
//         const expiringSoonQuery = Physio.aggregate([
//             {
//                 $match: {
//                     subscriptionId: { $ne: null },
//                     isDeleted: false,
//                     isBlocked: false
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'subscriptions',
//                     localField: 'subscriptionId',
//                     foreignField: '_id',
//                     as: 'subscription'
//                 }
//             },
//             { $unwind: '$subscription' },
//             {
//                 $addFields: {
//                     daysUntilExpiry: {
//                         $divide: [
//                             { $subtract: ["$subscription.expireAt", new Date()] },
//                             1000 * 60 * 60 * 24
//                         ]
//                     }
//                 }
//             },
//             {
//                 $match: {
//                     daysUntilExpiry: { $gte: 0, $lte: aboutToExpireInDays }
//                 }
//             },
//             { $count: 'count' }
//         ]);

//         // 3. Count physios with expired subscriptions
//         const expiredPhysioCountQuery = Physio.aggregate([
//             {
//                 $match: {
//                     subscriptionId: { $eq: null },
//                     subscriptionCount: { $gt: 0 },
//                     isDeleted: false,
//                     isBlocked: false
//                 }
//             },
//             { $count: 'count' }
//         ]);

//         // Run all three in parallel
//         const [freePlanLimitReached, expiringSoon, expiredPhysios] = await Promise.all([
//             freePlanLimitReachedQuery,
//             expiringSoonQuery,
//             expiredPhysioCountQuery
//         ]);

//         // Extract counts with fallback to 0
//         const physioWithExpiredFreePlanCount = freePlanLimitReached[0]?.count || 0;
//         const physioAboutToExpireCount = expiringSoon[0]?.count || 0;
//         const expiredPhysioCount = expiredPhysios[0]?.count || 0;

//         const data = {
//             physio: {
//                 freePlanExpiredCount: physioWithExpiredFreePlanCount,
//                 aboutToExpireCount: physioAboutToExpireCount,
//                 expiredCount: expiredPhysioCount
//             }
//         };

//         res.status(200).json({
//             success: true,
//             message: 'Physio subscription stats fetched successfully',
//             data
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch physio subscription stats',
//             error: error.message
//         });
//     }
// }


/**
 * @api {get} /api/admin/summary/summary-patients
 * @apiDescription Gets the stats of patients
 * @apiSuccess {Object} summary of patients
 * @apiSuccessExample {json} Success-Response:
 * {
 *   "approvedPhysioCount": 100,
 *   "pendingPhysioCount": 50,
 *   "todayPhysioCount": 5,
 *   "editRequestCount": 2,
 *   "todayEditRequestCount": 1,
 *   "withdrawalRequestCount": 3,
 *   "todayWithdrawalRequestCount": 1
 * }
 * @apiError {String} message description of error
 * @apiErrorExample {json} Error-Response:
 *   {
 *     "message": "Something went wrong"
 *   }
 */
exports.getSummaryPatients = async (req, res) => {
    try {

        // Date range for today
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        const endOfDay = new Date().setHours(23, 59, 59, 999);

        // ========== Patient Section ==========
        const patientTotalPromise = Patient.countDocuments();
        const patientTodayPromise = Patient.countDocuments({
            createdAt: { $gte: startOfDay, $lt: endOfDay }
        });

        // ========== Appointment Section ==========
        const appointmentPendingPromise = Appointment.countDocuments({ appointmentCompleted: false });
        const appointmentCompletedPromise = Appointment.countDocuments({ appointmentCompleted: true });
        const appointmentTodayPromise = Appointment.countDocuments({
            createdAt: { $gte: startOfDay, $lt: endOfDay }
        });

        // ========== Treatment Section ==========
        const treatmentPendingPromise = Appointment.countDocuments({
            appointmentStatus: 1,
            'isTreatmentScheduled.isTreatmentCompleted': false,
        });
        const treatmentCompletedPromise = Appointment.countDocuments({
            appointmentStatus: 1,
            'isTreatmentScheduled.isTreatmentCompleted': true,
        });
        const treatmentTodayPromise = Appointment.countDocuments({
            appointmentStatus: 1,
            updatedAt: { $gte: startOfDay, $lt: endOfDay }
        });

        // ========== Cashback Section ==========
        const cashbackTotalPromise = CashBack.countDocuments();
        const cashbackPendingPromise = CashBack.countDocuments({ status: { $in: ['pending', 'process'] } });
        const cashbackPaidPromise = CashBack.countDocuments({ status: 'success' });
        const cashbackTodayPromise = CashBack.countDocuments({
            createdAt: { $gte: startOfDay, $lt: endOfDay }
        });

        // Run all queries in parallel
        const [
            // Patient Section
            totalPatients, todayPatients,
            // Appointment Section
            pendingAppointments, completedAppointments, todayAppointments,
            // Treatment Section
            pendingTreatments, completedTreatments, todayTreatments,
            // Cashback Section
            totalCashbacks, pendingCashbacks, paidCashbacks, todayCashbacks
        ] = await Promise.all([
            // Patient Section
            patientTotalPromise, patientTodayPromise,
            // Appointment Section
            appointmentPendingPromise, appointmentCompletedPromise, appointmentTodayPromise,
            // Treatment Section
            treatmentPendingPromise, treatmentCompletedPromise, treatmentTodayPromise,
            // Cashback Section
            cashbackTotalPromise, cashbackPendingPromise, cashbackPaidPromise, cashbackTodayPromise
        ]);

        // Final Response Structuring
        const data = {
            patient: { total: totalPatients, today: todayPatients },
            appointment: {
                pending: pendingAppointments,
                completed: completedAppointments,
                today: todayAppointments
            },
            treatment: {
                pending: pendingTreatments,
                completed: completedTreatments,
                today: todayTreatments
            },
            cashback: {
                total: totalCashbacks,
                pending: pendingCashbacks,
                paid: paidCashbacks,
                today: todayCashbacks
            }
        };

        res.status(200).json({
            success: true,
            message: 'Patient summary fetched successfully',
            data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch patient summary',
            error: error.message
        });
    }
};


/**
 * @api {get} /api/admin/summary/patient-states
 * @apiDescription Gets the states of patients
 * @apiSuccess {Object[]} summary of patients with state
 * @apiSuccessExample {json} Success-Response:
 *   [
 *     {
 *       "_id": "Maharashtra",
 *       "total": 56,
 *     },
 *   ]
 * @apiError {String} message description of error
 * @apiErrorExample {json} Error-Response:
 *   {
 *     "message": "Something went wrong"
 *   }
 */
exports.getPatientStates = async (req, res) => {
    try {
        const { onboardedFrom } = req.query;

        const filter = {
            isDeleted: false,
            state: { $nin: [null, ''] }
        }

        if (onboardedFrom) {
            filter.onboardedFrom = onboardedFrom;
        }

        const states = await Patient.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: '$state',
                    total: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    state: '$_id',
                    total: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            message: 'Patient states fetched successfully',
            data: states
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch patient states',
            error: error.message
        });
    }
}


/**
 * @api {get} /api/admin/summary/patient-cities
 * @apiDescription Gets the cities of patients
 * @apiSuccess {Object[]} summary of patients with city
 * @apiSuccessExample {json} Success-Response:
 *   [
 *     {
 *       "_id": "Mumbai",
 *       "total": 56
 *     },
 *   ]
 * @apiError {String} message description of error
 * @apiErrorExample {json} Error-Response:
 *   {
 *     "message": "Something went wrong"
 *   }
 */
exports.getPatientCities = async (req, res) => {
    try {
        const { onboardedFrom } = req.query;

        const filter = {
            isDeleted: false,
            city: { $nin: [null, ''] }
        }

        if (onboardedFrom) {
            filter.onboardedFrom = onboardedFrom;
        }

        const cities = await Patient.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: '$city',
                    total: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    city: '$_id',
                    total: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            message: 'Patient cities fetched successfully',
            data: cities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch patient cities',
            error: error.message
        });
    }
}


/**
 * @api {get} /api/admin/summary/filter-patients
 * @apiDescription Filters patients based on state, city, and onboardedFrom
 * @apiSuccess {Object[]} filtered patients
 * @apiSuccessExample {json} Success-Response
 * @apiError {String} message description of error
 * @apiErrorExample {json} Error-Response
 */
// adjust path
exports.filterPatient = async (req, res) => {
    try {
        const { state, date, onboardedFrom, city } = req.query;

        let filter = {
            isDeleted: false
        };

        if (onboardedFrom) {
            filter.onboardedFrom = onboardedFrom;
        }

        if (state) {
            filter.state = state;
        }

        if (city && city.trim() !== "") {
            filter.city = { $regex: new RegExp(`^${city.trim()}`, 'i') };
        }

        const patients = await Patient.find(filter);

        let finalPatients = patients;

        // Now filter by date in JS (robustly handles string & Date)
        if (date?.trim()) {
            const startIST = moment.tz(date, 'Asia/Kolkata').startOf('day');
            const endIST = moment.tz(date, 'Asia/Kolkata').endOf('day');

            finalPatients = patients.filter((p) => {
                let created;
                try {
                    created = moment(p.createdAt);
                    return created.isBetween(startIST, endIST, null, '[]'); // inclusive
                } catch {
                    return false;
                }
            });
        }
        res.status(200).json({
            success: true,
            message: 'Patient filtered successfully',
            data: finalPatients
        });

    } catch (error) {
        console.error("Error filtering patients:", error);
        res.status(500).json({
            success: false,
            message: 'Failed to filter patient',
            error: error.message
        });
    }
};


