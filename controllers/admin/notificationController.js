const Notification = require('../../models/notification');
const Physio = require('../../models/physio');
const Patient = require('../../models/patient');
const { sendFCMNotification } = require('../../services/fcmService');
const moment = require('moment-timezone');

exports.getNotifications = async (req, res) => {
    try {
        const { page = 1, perPage = 10, date } = req.query;
        const limit = parseInt(perPage);
        const skip = (parseInt(page) - 1) * limit;

        let query = {};

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            query.createdAt = {
                $gte: startOfDay,
                $lte: endOfDay
            };
        }

        const total = await Notification.countDocuments(query);
        const notifications = await Notification.find(query)
            .populate('physioId patientId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const hasMore = skip + notifications.length < total;

        return res.status(200).json({
            message: 'Notifications fetched successfully',
            success: true,
            status: 200,
            page: parseInt(page),
            perPage: limit,
            total,
            hasMore,
            data: notifications,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
            message: 'Something went wrong',
            success: false,
            status: 500,
            error: error.message,
        });
    }
};


exports.sendNotification = async (req, res) => {
    try {
        const { physioId, patientId, audience, title, message } = req.body;

        if (!["PHYSIOS", "PATIENTS", "ALL", "SINGLE"].includes(audience)) {
            return res.status(400).json({
                message: 'Invalid audience. Audience should be `SINGLE`, `PHYSIOS`, `PATIENTS`, or `ALL`',
                success: false,
                status: 400,
                req: req.body
            });
        }

        if (audience === "PHYSIOS") {
            // Send Bulk Notification to Physios
            const physios = await Physio.find({
                isDeleted: false,
                isBlocked: false,
                deviceId: { $ne: null }
            });


        } else if (audience === "PATIENTS") {
            // Send Bulk Notification to Patients
            const patients = await Patient.find({
                isDeleted: false,
                isBlocked: false,
                deviceId: { $ne: null }
            });

        } else if (audience === "ALL") {
            // Send Bulk Notification to All
            const physios = await Physio.find({
                isDeleted: false,
                isBlocked: false,
                deviceId: { $ne: null }
            });

            const patients = await Patient.find({
                isDeleted: false,
                isBlocked: false,
                deviceId: { $ne: null }
            });

            const physioTokens = physios.map(physio => physio.deviceId);
            const patientTokens = patients.map(patient => patient.deviceId);

            const tokens = [...physioTokens, ...patientTokens];
            // await sendFCMNotification(tokens, title, message);
        }

        if (!physioId && !patientId) {
            return res.status(400).json({
                message: 'physioId or patientId is required',
                success: false,
                status: 400,
            });
        }

        if (!title || !message) {
            return res.status(400).json({
                message: 'title and message are required',
                success: false,
                status: 400
            });
        }

        if (physioId) {
            const physio = await Physio.findById({ _id: physioId });

            const data = {
                physioId: physio._id.toString(),
                title: title,
                body: message,
                type: 'other',
                from: 'admin',
                to: 'physio'
            }
            await sendFCMNotification(physio.deviceId, data);
        }

        if (patientId) {
            const patient = await Patient.findById({ _id: patientId });

            const data = {
                patientId: patient._id.toString(),
                title: title,
                body: message,
                type: 'other',
                from: 'admin',
                to: 'patient'
            }
            await sendFCMNotification(patient.deviceId, data);
        }

        return res.status(200).json({
            message: 'notification sent successfully',
            success: true,
            status: 200
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        return res.status(500).json({
            message: 'something went wrong',
            success: false,
            status: 500,
            error: error.message
        });
    }
};
