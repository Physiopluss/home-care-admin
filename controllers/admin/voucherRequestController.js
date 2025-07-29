const VoucherRequest = require('../../models/voucherRequest');
const moment = require('moment-timezone');
const Patient = require('../../models/patient');
const { sendFCMNotification } = require('../../services/fcmService');

// Get all voucher requests
exports.getAllVoucherRequests = async (req, res) => {
    try {

        const { Date } = req.query;

        if (!Date) {
            return res.status(400).json({
                message: 'Please provide Date',
                success: false,
                status: 400,
            });
        }

        const startDate = moment(Date).startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
        const endDate = moment(Date).endOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')


        let query = {};

        if (startDate && endDate) {
            query = {
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                }
            };
        }

        const voucherRequests = await VoucherRequest.find(query).populate('patientId')
        // console.log(voucherRequests, "voucher requests");
        res.status(200).json({ message: 'All voucher requests', status: 200, Success: true, voucherRequests });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching voucher requests', status: 500, Success: false });
    }
};


// voucher Add coin 
exports.addCoin = async (req, res) => {
    try {
        const { voucherRequestId, coin } = req.body;

        const voucherRequest = await VoucherRequest.findById(voucherRequestId);

        if (!voucherRequest) {
            return res.status(404).json({ message: 'Voucher request not found', status: 401, Success: false });
        }

        // patient Add wallet coin
        const patient = await Patient.findById(voucherRequest.patientId);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found', status: 401, Success: false });
        }

        await Patient.findByIdAndUpdate(patient._id, {
            $inc: { wallet: coin }
        });

        await VoucherRequest.findByIdAndUpdate(voucherRequestId, {
            $set: {
                coin: coin,
                status: 1,
                updatedDate: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
            }
        });

        if (patient && patient.deviceId) {
            const data = {
                title: `🎉 You've Earned ${coin} Physioplus Coins!`,
                body: `Congratulations! You've received ${coin} Physioplus Coins as a reward.`,
                patientId: patient._id.toString(),
                type: 'other',
                from: 'admin',
                to: 'patient',
                for: 'patient'
            }

            const result = await sendFCMNotification(patient.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }
        }

        res.status(200).json({ message: 'Coin added successfully', status: 200, Success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error adding coin', status: 500, Success: false });
    }
}

// Get Voucher By patientId
exports.getVoucherByPatientId = async (req, res) => {
    try {
        const patientId = req.query.patientId;

        if (!patientId) {
            return res.status(400).json({ message: 'Please provide patientId', status: 400, Success: false });
        }

        const voucherRequests = await VoucherRequest.find({ patientId: patientId }).populate('patientId');


        res.status(200).json({ message: 'All voucher requests for the patient', status: 200, Success: true, voucherRequests });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error fetching voucher requests', status: 500, Success: false });
    }
};

// Add coin By patent
exports.addCoinByPatient = async (req, res) => {
    try {
        const { patientId, coin } = req.body;

        if (!patientId || !coin) {
            return res.status(401).json({ message: 'Please provide patientId and coin', status: 401, Success: false });
        }

        const patient = await Patient.findById(patientId);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found', status: 404, Success: false });
        }

        const voucherRequest = VoucherRequest({
            patientId: patient._id,
            coin: coin,
            status: 1,
        })

        await voucherRequest.save();

        await Patient.findByIdAndUpdate(patient._id, {
            $inc: { wallet: coin }
        });

        if (patient && patient.deviceId) {
            const data = {
                title: `🎉 You've Earned ${coin} Physioplus Coins!`,
                body: `Congratulations! You've received ${coin} Physioplus Coins as a reward. Keep up the great work and unlock amazing benefits with your coins`,
                patientId: patient._id.toString(),
                type: 'other',
                from: 'admin',
                to: 'patient',
                for: 'patient'
            }

            const result = await sendFCMNotification(patient.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to patient", result);
            }
        }

        res.status(200).json({
            message: 'Coin added successfully',
            status: 200,
            success: true,
            voucherRequest: voucherRequest,
        });


    } catch (error) {
        return res.status(500).json({
            message: 'Error adding coin',
            status: 500,
            success: false,
            error: error.message,
        });
    }
};

// Today Voucher Request count
exports.todayVoucherRequestCount = async (req, res) => {
    try {
        const { Date } = req.query;

        // if(!Date){
        //     return res.status(400).json({
        //          message: 'Please provide Date',
        //          success: false,
        //          status: 400,
        //     });
        // }

        const startDate = moment().tz('Asia/Kolkata').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
        const endDate = moment().tz('Asia/Kolkata').endOf('day').format('yyyy-MM-DDTHH:mm:ss.ssssSS')

        let query = {};

        if (startDate && endDate) {
            query = {
                createdAt: {
                    $gte: startDate,
                    $lt: endDate
                }
            };
        }

        const todayVoucherRequests = await VoucherRequest.countDocuments(query);

        res.status(200).json({
            message: 'Today voucher request count',
            status: 200,
            success: true,
            todayVoucherRequests,
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error fetching today voucher request count',
            status: 500,
            success: false,
            error: error.message,
        });
    }
}

