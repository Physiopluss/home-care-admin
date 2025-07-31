const Appointment = require('../../models/appointment');
const Transaction = require('../../models/transaction');
const Physio = require('../../models/physio');
const mongoose = require('mongoose');
const Patient = require('../../models/patient');
const moment = require('moment-timezone');
const crypto = require('crypto');
const { redisClient } = require('../../utility/redisClient');
const appointment = require('../../models/appointment');
const generateRandomCode = require('../../utility/generateRandomCode');
const { createAppointmentInvoice } = require('../app/appointmentController');
const coupon = require('../../models/coupon');
const { sendFCMNotification } = require('../../services/fcmService');
const invoice = require('../../models/invoice');
const { formatToIsoMicroSeconds } = require('../../utility/helper');
const generateRandomOTP = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

// Get all appointments

exports.getConsultationSummary = async (req, res) => {
    try {
        // let query = { isDeleted: false, isBlocked: false, isPhysioConnect: true }

        const startOfDayIST = moment.tz(new Date(), 'Asia/Kolkata').startOf('day');
        const endOfDayIST = moment.tz(new Date(), 'Asia/Kolkata').endOf('day');
        const startUTC = new Date(startOfDayIST.toISOString());
        const endUTC = new Date(endOfDayIST.toISOString());
        const todayDate = { $gte: startUTC, $lte: endUTC };

        // Get Total Paid/Unpaid Physio Connect
        const total = await Appointment.countDocuments();
        const totalPending = await Appointment.countDocuments({ isAppointmentTransfer: false });
        const totalCompleted = await Appointment.countDocuments({ appointmentCompleted: true });
        const totalCash = await Appointment.countDocuments({ paymentMode: "cash" });
        const totalOnline = await Appointment.countDocuments({ paymentMode: "online" });
        const today = await Appointment.countDocuments({ createdAt: todayDate });

        // Get Today Paid/Unpaid Physio Connect
        return res.status(200).json({
            message: 'Physio Connect summary',
            status: 200,
            success: true,
            data: {
                total,
                totalPending,
                totalCompleted,
                totalCash,
                totalOnline,
                today
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

exports.allConsultation = async (req, res) => {
    console.log("Request Query:", req.query);
    try {
        const {
            name,
            status,
            date,
            page = 1,
            perPage = 10,
            cache = false
        } = req.query;

        const currentPage = parseInt(page);
        const limit = parseInt(perPage);
        const skip = (currentPage - 1) * limit;



        const matchStage = {};
        // console.log("Match Stage:", matchStage);
        // Handle status filtering
        if (status) {
            if (status === 'upcoming') matchStage.appointmentCompleted = false;
            else if (status === 'completed') matchStage.appointmentCompleted = true;
            else if (status === 'cash') matchStage.paymentMode = 'cash';
            else if (status === 'online') matchStage.paymentMode = 'online';
        }

        // Handle date filtering
        if (date) {
            const startOfDayIST = moment.tz(date, 'Asia/Kolkata').startOf('day');
            const endOfDayIST = moment.tz(date, 'Asia/Kolkata').endOf('day');
            matchStage.createdAt = {
                $gte: new Date(startOfDayIST.toISOString()),
                $lte: new Date(endOfDayIST.toISOString())
            };
        }

        // console.log("Match Stage:", matchStage);

        // Optional caching logic
        const keys = JSON.stringify({ name, status, date, page, perPage });
        const hash = crypto.createHash('sha256').update(keys).digest('hex');
        const cacheKey = `admin:AllPhysioConnect:${hash}`;

        // const cachedData = await redisClient.get(cacheKey);
        // if (cachedData) {
        //     console.log("> Returning cached data from Redis");
        //     return res.status(200).json(JSON.parse(cachedData));
        // }

        // Aggregation pipeline
        console.log(matchStage);

        const aggregationPipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'patients', // make sure this is the actual collection name
                    localField: 'patientId',
                    foreignField: '_id',
                    as: 'patientId'
                }
            },
            { $unwind: "$patientId" },
            {
                $lookup: {
                    from: 'physios', // make sure this is the actual collection name
                    localField: 'physioId',
                    foreignField: '_id',
                    as: 'physioId'
                }
            },
            { $unwind: "$physioId" },

            ...(name
                ? [{
                    $match: {
                        $or: [
                            { "patientId.fullName": { $regex: name.trim(), $options: 'i' } },
                            { "patientId.phone": { $regex: name.trim(), $options: 'i' } },
                            { "patientId.ZipCode": { $regex: name.trim(), $options: 'i' } }
                        ]
                    }
                }]
                : []
            ),

            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        // console.log("Aggregation Pipeline:", JSON.stringify(aggregationPipeline, null, 2));

        const result = await Appointment.aggregate(aggregationPipeline);

        const responseData = {
            message: "All Appointment",
            status: 200,
            success: true,
            data: result,
        };

        // await redisClient.set(cacheKey, JSON.stringify(responseData));

        return res.status(200).json(responseData);
    } catch (error) {
        console.error("Error in allConsultation:", error);
        return res.status(500).json({
            message: "Something went wrong. Please try again. " + error.message,
            status: 500,
            success: false
        });
    }
};



exports.allConsultationRequests = async (req, res) => {
    console.log("Request Query:", req.query);

    try {
        const {
            name,
            status,
            date,
            page = 1,
            perPage = 10,
            cache = false
        } = req.query;

        const currentPage = parseInt(page);
        const limit = parseInt(perPage);
        const skip = (currentPage - 1) * limit;
        const matchStage = {};
        matchStage.isAppointmentRequest = true
        // Handle status filtering
        if (status) {
            if (status === 'upcoming') matchStage.isAppointmentTransfer = false;
            else if (status === 'completed') matchStage.isAppointmentTransfer = true;
            else if (status === 'cash') matchStage.paymentMode = 'cash';
            else if (status === 'online') matchStage.paymentMode = 'online';
        }

        // Handle date filtering
        if (date) {
            const startOfDayIST = moment.tz(date, 'Asia/Kolkata').startOf('day');
            const endOfDayIST = moment.tz(date, 'Asia/Kolkata').endOf('day');
            matchStage.createdAt = {
                $gte: new Date(startOfDayIST.toISOString()),
                $lte: new Date(endOfDayIST.toISOString())
            };
        }

        console.log("Match Stage:", matchStage);

        // Optional caching logic
        const keys = JSON.stringify({ name, status, date, page, perPage });
        const hash = crypto.createHash('sha256').update(keys).digest('hex');
        const cacheKey = `admin:AllPhysioConnect:${hash}`;

        // const cachedData = await redisClient.get(cacheKey);
        // if (cachedData) {
        //     console.log("> Returning cached data from Redis");
        //     return res.status(200).json(JSON.parse(cachedData));
        // }

        // Aggregation pipeline
        const aggregationPipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'patients', // make sure this is the actual collection name
                    localField: 'patientId',
                    foreignField: '_id',
                    as: 'patientId'
                }
            },
            { $unwind: "$patientId" },
            {
                $lookup: {
                    from: 'physios', // make sure this is the actual collection name
                    localField: 'physioId',
                    foreignField: '_id',
                    as: 'physioId'
                }
            },
            { $unwind: "$physioId" },

            ...(name
                ? [{
                    $match: {
                        $or: [
                            { "patientId.fullName": { $regex: name.trim(), $options: 'i' } },
                            { "patientId.phone": { $regex: name.trim(), $options: 'i' } },
                            { "patientId.ZipCode": { $regex: name.trim(), $options: 'i' } }
                        ]
                    }
                }]
                : []
            ),

            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];
        const result = await Appointment.aggregate(aggregationPipeline);

        const responseData = {
            message: "All requestAppointment",
            status: 200,
            success: true,
            data: result,
        };

        // await redisClient.set(cacheKey, JSON.stringify(responseData));

        return res.status(200).json(responseData);
    } catch (error) {
        console.error("Error in allConsultation:", error);
        return res.status(500).json({
            message: "Something went wrong. Please try again. " + error.message,
            status: 500,
            success: false
        });
    }
};

exports.getAllTreatment = async (req, res) => {
    try {
        console.log('this');

        // Caching logic
        // let cacheKey = null;
        // if (cache) {
        //     const keys = { physioName, date, page, perPage }
        //     const hash = crypto.createHash('sha256').update(JSON.stringify(keys)).digest('hex');
        //     cacheKey = `admin:AllPhysioConnect:${hash}`;
        //     const cachedData = await redisClient.get(cacheKey);
        //     if (cachedData) {
        //         console.log("> Returning cached data (Admin AllPhysioConnect)");
        //         return res.status(200).json({
        //             message: "All physios connect",
        //             status: 200,
        //             success: true,
        //             ...JSON.parse(cachedData),
        //             query
        //         });
        //     }
        // }

        // Aggregation pipeline

        const result = await Appointment.find({ appointmentStatus: 1 });

        const responseData = {
            message: "All Treatment",
            status: 200,
            success: true,
            data: result,
        };

        // if (cache) {
        //     await redisClient.set(cacheKey, JSON.stringify(responseData), {
        //         EX: CACHE_EXPIRATION.ONE_HOUR
        //     });
        // }

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


exports.getAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find().populate('patientId physioId');
        return res.status(200).json({
            message: "All appointments",
            status: 200,
            success: true,
            data: appointments
        });
    } catch (error) {
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

// Get appointment by id
// exports.getAppointment = async (req, res) => {
//     try {
//         let appointmentId = req.params.id;

//         if (!appointmentId) {
//             return res.status(400).json({
//                 message: "Appointment id is required",
//                 status: 400,
//                 success: false
//             });
//         }

//         const appointment = await Appointment.findById(appointmentId).populate('patientId physioId');
//         return res.status(200).json({
//             message: "Appointment",
//             status: 200,
//             success: true,
//             data: appointment
//         });
//     } catch (error) {
//         return res.status(500).json({
//             message: "Semething went wrong",
//             status: 500,
//             success: false,
//             error: error.message
//         });
//     }
// };

// Get all appointments by Today
exports.getTodayAppointments = async (req, res) => {
    try {

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false,
            error: error.message
        });

    }
};

// Get Physio appointments
exports.getPhysioAppointments = async (req, res) => {
    try {

        const physioId = req.query.physioId;
        if (!physioId) {
            return res.status(400).json({
                message: "Physio id is required",
                status: 400,
                success: false
            });
        }

        // if check if physio exist
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(404).json({
                message: "Physio not found",
                status: 404,
                success: false
            });
        }

        const appointments = await Appointment.find({ physioId }).populate('patientId physioId');
        return res.status(200).json({
            message: "All appointments",
            status: 200,
            success: true,
            data: appointments
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false,
            error: error.message
        });

    }
};

// Get Appointment Chat
exports.getAppointmentChat = async (req, res) => {
    try {
        // return console.log(req.body, "shdfshfdj");
        const { patientId, physioId } = req.body;
        // Validate physioId and patientId as valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(physioId) || !mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({
                message: "Invalid physioId or patientId",
                status: 400,
                success: false
            });
        }
        // Fetch chat history between physio and patient
        const chatHistory = await Chat.findOne({
            // $and: [
            physioId,
            patientId
            // ]
        });
        if (!chatHistory) {
            return res.status(404).json({
                message: "No chat history found",
                status: 404,
                success: false
            });
        }

        return res.status(200).json({
            message: "Chat history",
            status: 200,
            success: true,
            data: chatHistory
        });

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            message: "Semething went wrongnnnnn",
            status: 500,
            success: false,
            error: error.message
        });

    }
};

exports.addAppointment = async (req, res) => {
    try {
        const {
            phone,
            patientName,
            physioId,
            date,
            age,
            gender,
            couponId,
            amount,
            painNotes,
            paymentMode,
            appointmentAddressLink
        } = req.body;

        const requiredFields = {
            physioId,
            date,
            patientName,
            age,
            phone
        };

        for (const [key, value] of Object.entries(requiredFields)) {
            if (!value) {
                return res.status(400).json({
                    message: `${key} is required`,
                    success: false,
                    status: 400
                });
            }
        }

        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: 'Physio not found',
                success: false,
                status: 400
            });
        }

        let patient = await Patient.findOne({ phone: `+91${phone}` });

        const extractLatLng = (link) => {
            const latLngMatch = link?.match(/!3d([-.\d]+)!4d([-.\d]+)/);
            if (latLngMatch) return { lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) };

            const atMatch = link?.match(/@([-.\d]+),([-.\d]+)/);
            if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

            return { lat: null, lng: null };
        };

        const { lat, lng } = extractLatLng(appointmentAddressLink);

        if (!patient) {
            patient = new Patient({
                fullName: patientName,
                phone: `+91${phone}`,
                gender: gender || null,
                latitude: lat,
                longitude: lng
            });

            await patient.save();
        } else if (patient.latitude === null && patient.longitude === null) {
            patient.latitude = lat;
            patient.longitude = lng;
            await patient.save();
        }
        // Check if slot already booked
        const data = {
            patientId: patient._id,
            physioId,
            status: 0,
            date: formatToIsoMicroSeconds(date),
            patientName,
            age,
            gender,
            phone,
            otp: Number(generateRandomOTP()),
            painNotes,
            amount,
            paymentMode,
            bookingSource: "admin",
            isAppointmentRequest: true,
            isAppointmentTransfer: true

        }
        const appointment = new Appointment(data);
        const platformCharges = (amount * 22) / 100;
        const gst = (platformCharges * 18) / 100;

        await Physio.findByIdAndUpdate(physio._id, {
            $inc: { wallet: (amount - (platformCharges + gst)) }
        });
        const transaction = await Transaction.create({
            physioId: physio._id,
            patientId: patient._id,
            appointmentId: appointment._id,
            couponId: couponId || null,
            amount: amount,
            transactionId: `PHONL_${generateRandomCode()}`,
            patientTransactionType: "debit",
            physioTransactionType: "credit",
            paymentStatus: paymentMode === "online" ? "paid" : "pending",
            paymentMode: paymentMode,
            paidTo: "physio",
            paidFor: "appointment",
            platformCharges: platformCharges,
            gstAmount: gst,
            physioPlusAmount: platformCharges,
            physioAmount: (amount - (platformCharges + gst)),
        });
        appointment.transactionId = transaction._id;
        await appointment.save();

        // notification section 

        let notification = {
            title: "Upcoming consultation!",
            body: `You have upcoming home consultation with ${patient.fullName}`,
            physioId: physio._id.toString(),
            name: patient.fullName,
            time: appointment.time,
            date: appointment.date,
            type: 'appointment',
            from: 'admin',
            to: 'physio',
            for: 'physio'
        }

        if (physio) {

            let result = await sendFCMNotification(physio?.deviceId, notification)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }

            notification = {}
            notification.title = "Upcoming consultation!",
                notification.body = `You have upcoming home consultation ${physio.fullName}`,
                notification.name = physio.fullName
            notification.type = 'appointment'
            notification.from = 'admin'
            notification.to = 'patient'
            notification.for = 'patient'
            notification.physioId = null
            notification.patientId = patient._id.toString(),
                result = await sendFCMNotification(patient?.deviceId, notification)

            if (!result.success) {
                console.log("Error sending notification to patient", result);
            }

        }
        return res.status(200).json({
            message: 'Appointment created',
            success: true,
            status: 200,
            data: appointment
        });

    } catch (error) {
        console.error("Error in addAppointment:", error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500,
            error: error.message
        });
    }
};

exports.consultationRequest = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(404).json({
                message: "id is required",
                status: 404,
                success: false
            });
        }

        const appointment = await Appointment.findById(id,)
            .populate('physioId patientId')
            .populate({
                path: 'physioId',
                populate: [
                    { path: 'specialization', model: 'Specialization' },
                    { path: 'bptDegree.degreeId', model: 'Degree' },
                    { path: 'mptDegree.degreeId', model: 'Degree' },
                    { path: 'degree.degreeId', model: 'Degree' }
                ]
            });

        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found",
                status: 404,
                success: false
            });
        }

        return res.status(200).json({
            message: "Single Appointment",
            status: 200,
            success: true,
            data: appointment
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};

exports.acceptConsultationRequest = async (req, res) => {
    try {
        const { id, payload } = req.body;

        console.log(payload);


        if (!id && !payload) {
            return res.status(404).json({
                message: "id and payload is required",
                status: 404,
                success: false
            });
        }


        const data = await Appointment.findByIdAndUpdate(id,
            {
                patientId: payload.patientId,
                physioId: payload.physioId || null,
                requestConsultationId: appointment?._id || null,
                status: 0,
                paymentMode: payload.paymentMode,
                date: payload.date || null,
                time: payload.time || null,
                patientName: payload.patientName || null,
                age: payload.age || null,
                gender: payload.gender || null,
                phone: payload.phone || null,
                painNotes: payload.painNotes || null,
                amount: payload.amount || null,
                otp: payload.otp || null,
                bookingSource: payload.bookingSource || null,
                couponId: payload.couponId || null,
                isAppointmentTransfer: true,
            }, {
            new: true
        }
        )

        if (data) {
            return res.status(200).json({
                message: "Accept successFully",
                status: 200,
                success: true,
                data: data
            });

        }

        return res.status(400).json({
            message: "Appointment not found",
            status: 400,
            success: false
        });



    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};



// Get Appointment 
exports.getAppointmentsGet = async (req, res) => {
    try {

        // Get Today Appointments
        const today = moment().startOf('day').toISOString();
        const tomorrow = moment().add(1, 'days').startOf('day').toISOString();

        // const appointments = await Appointment.find({
        //     createdAt: {
        //         $gte: today,
        //         $lt: tomorrow
        //     }
        // }).populate('patientId physioId');

        return res.status(200).json({
            message: "Today's appointments",
            status: 200,
            success: true,
            // appointment: appointments.length,
            // data: appointments
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false,
            error: error.message
        });

    }
};

// Get Appointments By treatments
exports.getAppointment = async (req, res) => {
    try {
        const { appointmentStatus, date, patientName } = req.query;
        let filter = {};

        if (appointmentStatus !== undefined) {
            filter.appointmentStatus = appointmentStatus;
        }

        if (patientName !== undefined) {
            const patients = await Patient.find({
                fullName: { $regex: new RegExp(patientName, "i") }
            });

            // Extract patient IDs
            const patientIds = patients.map(patient => patient._id);

            // Add to filter
            filter.patientId = { $in: patientIds };
        }

        if (date) {
            const today = moment(date).startOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            const tomorrow = moment(date).endOf('day').tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')

            filter.createdAt = {
                $gte: today,
                $lte: tomorrow
            };
        }

        const [appointments, mobileCount, websiteCount] = await Promise.all([
            Appointment.find(filter)
                .populate("patientId", "fullName phone city state zipCode")
                .populate("physioId", "fullName phone"),

            Appointment.find({
                ...filter,
                bookingSource: 'mobile'
            }),

            Appointment.find({
                ...filter,
                bookingSource: 'website'
            })
        ]);

        return res.status(200).json({
            message: "Appointments fetched successfully",
            status: 200,
            success: true,
            mobileCount: mobileCount.length,
            websiteCount: websiteCount.length,
            data: appointments
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

// Get Appointments By treatments
exports.getAppointmentByTreatment = async (req, res) => {
    try {
        const { date } = req.query;
        const today = moment().tz('Asia/Kolkata').startOf('day').format('YYYY-MM-DDTHH:mm:ss.ssssSS');
        const tomorrow = moment().tz('Asia/Kolkata').endOf('day').format('YYYY-MM-DDTHH:mm:ss.ssssSS');

        const appointments = await Appointment.find({
            'isTreatmentScheduled.treatmentDate.date': { $gte: today, $lte: tomorrow }
        });

        return res.status(200).json({
            message: "Appointments fetched successfully",
            status: 200,
            success: true,
            data: appointments
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.verifyTreatmentSingleDayPayment = async (req, res) => {

    console.log("req.body");
    console.log(req.body);


    try {
        const {
            id,
            dateIds,
            couponId } = req.body;
        if (!id && !dateIds) {
            return res.status(400).json({
                message: 'All are is required',
                success: false,
                status: 400
            });
        }
        if (couponId) {
            const coupon = await coupon.findById(couponId);
            if (!coupon) return res.status(400).json({
                message: 'Coupon not found',
                success: false,
                status: 400
            });
        }

        const appointment = await Appointment.findById(id).populate('patientId');

        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found",
                success: false,
                status: 404
            });
        }

        if (!appointment.isTreatmentScheduled || !appointment.isTreatmentScheduled.treatmentDate) {
            return res.status(400).json({
                message: "No treatment date found for this appointment",
                success: false,
                status: 400
            });
        }

        // Check if each treatment date in the dateIdArray exists
        const treatmentDates = appointment.isTreatmentScheduled.treatmentDate.filter(treatment =>
            dateIds.includes(treatment._id.toString()) // Ensure you are matching the correct ID
        );

        if (treatmentDates.length === 0) {
            return res.status(404).json({
                message: "No matching treatment dates found",
                success: false,
                status: 404
            });
        }

        // Mark each specific treatment date as paid and update adminAmount
        treatmentDates.forEach(treatment => {
            treatment.isPaid = true; // Marking it as paid
            treatment.paymentStatus = 0; // paymentStatus 0-online 1-offline
        });

        const amount = treatmentDates?.length * appointment.isTreatmentScheduled.amount;
        appointment.adminAmount = (appointment.adminAmount || 0) + amount
        await appointment.save();
        // total amount
        let PlatformCharges = (amount * 22) / 100; // platform charges
        let gst = (PlatformCharges * 18) / 100; //gst charges

        // admin amount = total amount - (platform charges + gst charges)
        console.log(` amount is: ${amount}`, "coin =");
        console.log(`22% of the amount is: ${PlatformCharges}`);
        console.log(`18% of 22% of the amount is: ${gst}`);

        // physio amount update
        const physio = await Physio.findByIdAndUpdate(appointment.physioId, {
            $inc: {
                // wallet amount plus
                wallet: ((amount - (PlatformCharges + gst))),
            }
        }, {
            new: true
        });

        await Transaction.create({
            physioId: physio._id,
            patientId: appointment.patientId,
            appointmentId: appointment._id,
            couponId: couponId || null,
            amount: amount,
            transactionId: `PHONL_${generateRandomCode()}`,
            physioTransactionType: "credit",
            patientTransactionType: "debit",
            paymentStatus: "paid",
            paymentMode: "online",
            paidTo: "physio",
            paidFor: "treatment",
            platformCharges: PlatformCharges,
            gstAmount: gst,
            physioPlusAmount: PlatformCharges,
            physioAmount: (amount - (PlatformCharges + gst)),
            isTreatment: true
        });

        return res.status(200).json({
            message: "Payment Confirmed",
            status: 200,
            success: true,
        });
    } catch (error) {
        console.error("Error in payment verification:", error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};

exports.getAllTreatmentsData = async (req, res) => {
    console.log("this", req.query);

    try {


        const {
            name,
            status,
            date,
            freePhysio,
            planType,
            page = 1,
            perPage = 10,
            cache = false
        } = req.query;

        let filter = {
            // appointmentStatus: 1,
            // "isTreatmentScheduled.isTreatmentTransfer": true,
            // patientId: { $ne: null },
            // physioId: { $ne: null },
            // 'isTreatmentScheduled.isTreatmentCompleted': false
        }

        const treatments = await Appointment.find({ "isTreatmentScheduled.isTreatmentTransfer": true }).populate('patientId physioId').sort({ createdAt: -1 });

        console.log(treatments);


        return res.status(200).json({
            message: "Treatments fetched successfully",
            status: 200,
            success: true,
            data: treatments
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.getAllTreatmentRequestsData = async (req, res) => {
    try {

        const treatments = await Appointment.find({
            appointmentStatus: 1,
            'isTreatmentScheduled.isTreatmentRequest': true
        }).populate('physioId patientId').sort({ 'createdAt': -1 });
        if (treatments) {
            return res.status(200).json({
                message: "Treatments fetched successfully",
                status: 200,
                success: true,
                data: treatments
            });
        }

        console.log(treatments);

        return res.status(404).json({
            message: "Treatments not found",
            status: 404,
            success: false,

        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.treatmentRequest = async (req, res) => {

    try {
        const { id } = req.query;
        if (!id) {
            return res.status(404).json({
                message: "id is required",
                status: 404,
                success: false
            });
        }
        const reqApp = await Appointment.findById(id);
        if (reqApp) {
            return res.status(200).json({
                message: "treatment is fetch",
                status: 200,
                success: true,
                data: reqApp

            });

        }
        else {
            return res.status(404).json({
                message: "App not found",
                status: 404,
                success: false,

            });
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.getTreatment = async (req, res) => {
    try {
        let filter = {
            appointmentStatus: 1,
            'isTreatmentScheduled.isTreatmentCompleted': false,
        };

        const treatments = await Appointment.find(filter)
            .populate('patientId physioId');

        return res.status(200).json({
            message: "Treatments fetched successfully",
            status: 200,
            success: true,
            data: treatments
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.treatmentScheduleFromAdmin = async (req, res) => {
    try {
        const {
            id,
        } = req.query;

        // Validation checks
        if (!id) {
            return res.status(400).send({
                message: "AppointmentId is required",
                status: 400,
                success: false
            });
        }


        // Validate physioId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid PhysioId format",
                status: 400,
                success: false
            });
        }

        // Find appointment
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).send({
                message: "Appointment not found",
                status: 404,
                success: false,
            });
        }
        // Save treatment data
        appointment.isTreatmentScheduled = {
            isTreatmentRequest: true,
        };
        appointment.appointmentStatus = 1;
        appointment.otpStatus = true;

        await appointment.save();

        // Send Notifications
        // if (patient?.deviceId && physio?.deviceId) {
        //     const dataToPhysio = {
        //         title: "Treatment Scheduled",
        //         body: `You have successfully created a treatment with ${patient.fullName} for ${totalDays} days`,
        //         physioId: physio._id.toString(),
        //         name: patient.fullName,
        //         time: appointment.time,
        //         date: appointment.date,
        //         type: 'treatment',
        //         from: 'admin',
        //         to: 'physio',
        //         for: 'physio'
        //     };

        //     const resultToPhysio = await sendFCMNotification(physio.deviceId, dataToPhysio);
        //     if (!resultToPhysio.success) {
        //         console.log("Error sending notification to physio", resultToPhysio.error);
        //     }

        //     const dataToPatient = {
        //         title: "Treatment Scheduled",
        //         body: `Your treatment for ${totalDays} days has been scheduled.`,
        //         patientId: patient._id.toString(),
        //         name: physio.fullName,
        //         type: 'treatment',
        //         from: 'admin',
        //         to: 'patient',
        //         for: 'patient'
        //     };

        //     const resultToPatient = await sendFCMNotification(patient.deviceId, dataToPatient);
        //     if (!resultToPatient.success) {
        //         console.log("Error sending notification to patient", resultToPatient.error);
        //     }
        // }
        return res.status(200).send({
            message: "Treatment schedule added successfully",
            status: 200,
            success: true,
            data: appointment
        });

    } catch (error) {
        console.log("Error in treatmentSchedule:", error.message);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.completeTreatment = async (req, res) => {
    try {
        const {
            id
        } = req.query;

        if (!id) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById({
            _id: id
        })


        if (!appointment) return res.status(400).json({
            message: 'Appointment not found',
            success: false,
            status: 400
        });


        if (appointment.isTreatmentScheduled.isTreatmentCompleted === true) return res.status(400).json({
            message: 'Treatment Already Completed',
            success: false,
            status: 400
        });

        const GetTreamentDate = appointment.isTreatmentScheduled.treatmentDate
        //Check if the getLastDateObject is before today's date to determine if the treatment is complete.
        const getLastDateObject = GetTreamentDate[(GetTreamentDate.length - 1)]
        const todayDate = moment.tz('Asia/kolkata').format('YYYY-MM-DD')
        const lastDateCheck = moment(getLastDateObject.date).tz('Asia/kolkata').format('YYYY-MM-DD')

        if (todayDate <= lastDateCheck) {
            return res.status(403).json({
                message: 'Treatment Complete only last date or after last date',
                success: false,
                status: 403,
            });
        }

        let updateAppointment = await Appointment.findByIdAndUpdate({
            _id: id
        }, {
            otpStatus: true,
            'isTreatmentScheduled.isTreatmentCompleted': true,
        }, {
            new: true
        })

        // Fetch the patient and physio associated with the appointment
        const patient = await Patient.findById(appointment.patientId);
        const physio = await Physio.findById(appointment.physioId);

        await createAppointmentInvoice(appointmentId, isTreatment = true);
        if (physio && physio.deviceId) {
            const data = {
                title: "Treatment Completed",
                physioId: physio._id.toString(),
                name: patient.fullName,
                time: appointment.time,
                date: appointment.date,
                type: 'treatment',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            // Send Notification to physio
            data.body = `A treatment with ${patient?.fullName} has been completed successfully.`
            let result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result.error);
            }

            // Send Notification to patient
            data.body = `Your treatment with ${physio?.fullName} has been completed successfully.`
            data.name = physio.fullName
            data.type = 'treatment',
                data.from = 'admin',
                data.to = 'patient',
                data.for = 'patient'
            data.physioId = null
            data.patientId = patient._id.toString()
            result = await sendFCMNotification(patient?.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to patient", result.error);
            }
        }

        return res.status(200).json({
            message: 'Treatment Completed',
            success: true,
            status: 200,
            data: updateAppointment,

        });

    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            message: 'Something went wrong Please try again',
            success: false,
            status: 500,
            error: error.message
        });
    }
};

exports.acceptTreatmentRequest = async (req, res) => {
    console.log(JSON.stringify(req.body.payload.isTreatmentScheduled.treatmentDate))

    try {
        const { id, payload } = req.body;

        if (!id || !payload) {
            return res.status(400).json({
                message: "Both 'id' and 'payload' are required",
                status: 400,
                success: false
            });
        }

        const appointment = await Appointment.findById(id);

        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found",
                status: 404,
                success: false
            });
        }

        // Ensure nested object exists
        if (!appointment.isTreatmentScheduled) {
            appointment.isTreatmentScheduled = {};
        }

        // Conditionally update only if present
        const treatmentDate = payload.isTreatmentScheduled.treatmentDate;

        if (Array.isArray(treatmentDate)) {
            // array of objects
            appointment.isTreatmentScheduled.treatmentDate = treatmentDate.map(item => ({
                ...item,
                date: formatToIsoMicroSeconds(item.date)
            }));
        }
        if (typeof payload.isTreatmentScheduled.amount !== "undefined") {
            appointment.isTreatmentScheduled.amount = payload.isTreatmentScheduled.amount;
        }

        if (payload.isTreatmentScheduled.startTime) {
            appointment.isTreatmentScheduled.startTime = payload.isTreatmentScheduled.startTime;
        }

        if (payload.isTreatmentScheduled.endTime) {
            appointment.isTreatmentScheduled.endTime = payload.isTreatmentScheduled.endTime;
        }

        if (typeof payload.isTreatmentScheduled.isTreatmentCompleted !== "undefined") {
            appointment.isTreatmentScheduled.isTreatmentCompleted = payload.isTreatmentScheduled.isTreatmentCompleted;
        }

        if (payload.prescriptionNotes) {
            appointment.isTreatmentScheduled.prescriptionNotes = payload.prescriptionNotes;
        }

        // Always set these
        appointment.appointmentStatus = 1;
        appointment.isTreatmentScheduled.isTreatmentTransfer = true;

        await appointment.save();

        return res.status(200).json({
            message: "Treatment successfully transferred",
            status: 200,
            success: true,
            data: appointment
        });

    } catch (error) {
        console.error("acceptTreatmentRequest error:", error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        });
    }
};

exports.getTreatmentsSummary = async (req, res) => {
    try {
        // let query = { isDeleted: false, isBlocked: false, isPhysioConnect: true }

        const startOfDayIST = moment.tz(new Date(), 'Asia/Kolkata').startOf('day');
        const endOfDayIST = moment.tz(new Date(), 'Asia/Kolkata').endOf('day');
        const startUTC = new Date(startOfDayIST.toISOString());
        const endUTC = new Date(endOfDayIST.toISOString());
        const todayDate = { $gte: startUTC, $lte: endUTC };

        // Get Total Paid/Unpaid Physio Connect
        const total = await Appointment.countDocuments({ appointmentStatus: 1 });
        const totalPending = await Appointment.countDocuments({ appointmentStatus: 1, "isTreatmentScheduled.isTreatmentTransfer": false });
        const totalCompleted = await Appointment.countDocuments({ appointmentStatus: 1, "isTreatmentScheduled.isTreatmentCompleted": true });
        const totalCash = await Appointment.countDocuments({ appointmentStatus: 1, paymentMode: "cash" });
        const totalOnline = await Appointment.countDocuments({ appointmentStatus: 1, paymentMode: "online" });
        const today = await Appointment.countDocuments({ appointmentStatus: 1, updatedAt: todayDate });

        // Get Today Paid/Unpaid Physio Connect
        return res.status(200).json({
            message: 'Physio Connect summary',
            status: 200,
            success: true,
            data: {
                total,
                totalPending,
                totalCompleted,
                totalCash,
                totalOnline,
                today
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

exports.completeConsultation = async (req, res) => {
    try {
        const {
            id,
        } = req.query;

        if (!id) return res.status(400).json({
            message: 'AppointmentId  and otp is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById({
            _id: id
        });

        if (!appointment) return res.status(400).json({
            message: 'Appointment not found',
            success: false,
            status: 400
        });

        const patient = await Patient.findById(appointment.patientId);
        const physio = await Physio.findById(appointment.physioId).populate({
            path: 'subscriptionId',
        });

        let updateAppointment = await Appointment.findByIdAndUpdate({
            _id: id
        }, {
            appointmentCompleted: true
        }, {
            new: true
        })
        physio.subscriptionId.patientCount += 1;
        await physio.subscriptionId?.save();

        // Unapprove physio if patient count exceeds limit in free plan
        const planType = physio.subscriptionId.planId.planType;
        if (physio.subscriptionId.patientCount >= 4 && planType === 0) {
            await Physio.findByIdAndUpdate(
                physio._id,
                { accountStatus: 0 },
                { new: true }
            );
        }

        // Send FCM notification to physio
        // if (physio.deviceId) {
        //     const physioData = {
        //         title: "Consultation Completed",
        //         body: `Your consultation with ${patient.fullName} has been completed successfully.`,
        //         physioId: physio._id.toString(),
        //         name: patient.fullName,
        //         time: appointment.time,
        //         date: appointment.date,
        //         type: "appointment",
        //         from: "admin",
        //         to: "physio",
        //         for: "physio",
        //     };

        //     const resultPhysio = await sendFCMNotification(physio.deviceId, physioData);
        //     if (!resultPhysio || resultPhysio.success === false) {
        //         console.log("Error sending notification to physio", resultPhysio);
        //     }
        // }

        // Send FCM notification to patient
        // if (patient.deviceId) {
        //     const patientData = {
        //         title: "Consultation Completed",
        //         body: `Your consultation with ${physio.fullName} has been completed successfully.`,
        //         name: physio.fullName,
        //         patientId: patient._id.toString(),
        //         type: "appointment",
        //         from: "admin",
        //         to: "patient",
        //         for: "patient",
        //     };

        //     const resultPatient = await sendFCMNotification(patient.deviceId, patientData);
        //     if (!resultPatient || resultPatient.success === false) {
        //         console.log("Error sending notification to patient", resultPatient);
        //     }
        // }

        // Generate invoice and send chat message

        await createAppointmentInvoice(id)
        return res.status(200).json({
            message: 'Appointment Completed',
            success: true,
            status: 200,
            data: updateAppointment
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Something went wrong Please try again',
            success: false,
            status: 500
        });
    }
};

exports.completeTreatment = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById({
            _id: id
        });

        if (!appointment) return res.status(400).json({
            message: 'Appointment not found',
            success: false,
            status: 400
        });

        let updateAppointment = await Appointment.findByIdAndUpdate({
            _id: id
        }, {
            'isTreatmentScheduled.isTreatmentCompleted': true
        }, {
            new: true
        })

        return res.status(200).json({
            message: 'Treatment Completed',
            success: true,
            status: 200,
            data: updateAppointment
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Something went wrong Please try again',
            success: false,
            status: 500
        });
    }
};

exports.deleteTreatment = async (req, res) => {
    try {
        const { appointmentId } = req.query

        if (!appointmentId && !mongoose.Types.ObjectId.isValid(appointmentId)) {
            return res.status(404).json({
                message: "AppointmentId is required and must be a valid ObjectId",
                status: 404,
                success: false
            });
        }

        const appointment = await Appointment.findById(appointmentId)
        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found",
                status: 404,
                success: false
            });
        }

        appointment.isTreatmentRequested = false
        appointment.appointmentStatus = 0
        appointment.isTreatmentScheduled = {
            startTime: "",
            endTime: "",
            prescriptionNotes: "",
            status: 0,
            treatmentDate: [],
            amount: null,
            treatmentServiceType: null,
            isTreatmentCompleted: false
        }
        await appointment.save()

        return res.status(200).json({
            message: "Treatment deleted successfully",
            status: 200,
            success: true,
            data: appointment,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong, please try again later" + error,
            status: 500,
            success: false
        });
    }
}

exports.requestFilter = async (req, res) => {
    try {
        const {
            name,
            status,
            date,
            page = 1,
            perPage = 10,
            cache = false
        } = req.query;

        console.log(req.query);

        const currentPage = parseInt(page);
        const limit = parseInt(perPage);
        const skip = (currentPage - 1) * limit;

        let query = {
            isDeleted: false, isBlocked: false
        };

        if (status) {
            switch (status) {

                // case 'all': { query}
                // case "pending" : {query.}

            }
        }

        if (name) {
            const searchTerm = name.toLowerCase().trim();
            query.$or = [
                { "patientId.fullName": { $regex: searchTerm, $options: 'i' } },
                { "patientId.phone": { $regex: searchTerm, $options: 'i' } },
                { "patientId.zipCode": { $regex: searchTerm, $options: 'i' } },
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
                console.log("> Returning cached data ( requestFilter)");
                return res.status(200).json({
                    message: "All Request",
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


exports.getInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const appointmentStatus = parseInt(req.query.appointmentStatus || "0");

        if (!id) {
            return res.status(400).json({
                message: 'appointmentId is required',
                status: 400,
            });
        }

        console.log("Fetching invoice for:", { id, appointmentStatus });

        const invoices = await invoice.findOne({
            appointmentId: id,
            type: appointmentStatus === 0 ? "appointment" : "treatment"
        }).populate('transactionId patientId physioId appointmentId');

        return res.status(200).json({
            message: 'Invoices fetched',
            success: true,
            status: 200,
            data: invoices
        });

    } catch (error) {
        console.error("Error in getInvoice:", error);
        return res.status(500).json({
            message: 'Something went wrong, please try again',
            status: 500,
            success: false,
            error: error.message
        });
    }
};

