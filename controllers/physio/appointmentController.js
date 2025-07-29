const Appointment = require('../../models/appointment');
const Patient = require('../../models/patient');
const Physio = require('../../models/physio');
const moment = require('moment');
const mongoose = require('mongoose');
const Transaction = require('../../models/transaction');
const {
    msg91OTP
} = require('msg91-lib');

const crypto = require('crypto');


const generateRandomCode = require('../../utility/generateRandomCode');

const PhysioHelper = require('../../utility/physioHelper');
const { createAppointmentInvoice } = require('../app/appointmentController');
const { sendFCMNotification } = require('../../services/fcmService');
const { CashBackCacheKey, GiveCashBack } = require('../../utility/cashBackUtility');
const { redisClient } = require('../../utility/redisClient');



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

generateUnique6CharID()
const msg91otp = new msg91OTP({
    authKey: process.env.MSG91_AUTH_KEY,
    templateId: process.env.MSG91_TEMP_ID
});


exports.getPhysioAppointments = async (req, res) => {
    try {
        const { physioId, appointmentStatus, appointmentCompleted, isTreatmentCompleted } = req.query;
        const query = {
            physioId,
        };


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
            return res.status(401).json({
                message: 'Physio not found',
                success: false,
                status: 401
            });
        }
        if (appointmentStatus !== undefined && appointmentStatus !== null && appointmentStatus !== '') {
            query.appointmentStatus = parseInt(appointmentStatus);
        }

        if (appointmentCompleted !== undefined && appointmentCompleted !== null && appointmentCompleted !== '') {
            query.appointmentCompleted = appointmentCompleted === "true" || appointmentCompleted === true;
        }

        if (isTreatmentCompleted !== undefined && isTreatmentCompleted !== null && isTreatmentCompleted !== '') {
            query["isTreatmentScheduled.isTreatmentCompleted"] = isTreatmentCompleted === "true" || isTreatmentCompleted === true;
        }
        const appointments = await Appointment.find(query).populate({
            path: 'physioId',
            populate: [
                { path: 'specialization', model: 'Specialization' },
                { path: 'subscriptionId', model: 'Subscription' },
                { path: 'degree.degreeId', model: 'Degree' },
                { path: 'bptDegree.degreeId', model: 'Degree' },
                { path: 'mptDegree.degreeId', model: 'Degree' }
            ]
        }).populate('patientId');

        return res.status(200).json({
            success: true,
            message: "Appointments fetched successfully",
            data: appointments,
        });
    } catch (error) {
        console.error("Error in getPhysioAppointments:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
};



exports.getAppointmentComplete = async (req, res) => {
    try {
        const { physioId, appointmentCompleted, appointmentStatus, isTreatmentCompleted } = req.query;

        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });

        const query = { physioId };

        if (appointmentCompleted) {
            query.appointmentCompleted = appointmentCompleted;
        }

        if (appointmentStatus) {
            query.appointmentStatus = appointmentStatus;
        }

        if (isTreatmentCompleted) {
            query['isTreatmentScheduled.isTreatmentCompleted'] = isTreatmentCompleted;
        }

        const physio = await Physio.findById(physioId);
        if (!physio) return res.status(404).json({
            message: 'Physio not found',
            success: false,
            status: 404
        });

        const appointments = await Appointment.find(query)
            .populate('physioId patientId')
            .populate({
                path: 'physioId',
                populate: {
                    path: 'specialization',
                    model: 'Specialization'
                }
            }).sort({ createdAt: -1 });
        return res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: appointments
        });


    } catch (error) {
        return res.status(500).json({
            message: 'Something went wrong, please try again',
            status: 500,
            success: false,
            error: error.message
        })
    }
}


// Get Today appointment

exports.getTodayAppointments = async (req, res) => {
    try {
        const { physioId } = req.query;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }

        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).json({
                message: 'Invalid PhysioId',
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

        // Today's date range (both as Date and ISO string)
        const startDayDate = moment().startOf('day').toDate();
        const endDayDate = moment().endOf('day').toDate();
        const startDayISO = moment(startDayDate).toISOString();
        const endDayISO = moment(endDayDate).toISOString();

        console.log("Start of day (Date):", startDayDate);
        console.log("End of day (Date):", endDayDate);

        const appointments = await Appointment.find({
            physioId,
            appointmentCompleted: false,
            $or: [
                {
                    date: { $gte: startDayDate, $lte: endDayDate }
                },
                {
                    date: { $gte: startDayISO, $lte: endDayISO }
                }
            ]
        })
        .populate({
            path: 'physioId',
            populate: [
                { path: 'specialization', model: 'Specialization' },
                { path: 'subscriptionId', model: 'Subscription' },
                { path: 'degree.degreeId', model: 'Degree' },
                { path: 'bptDegree.degreeId', model: 'Degree' },
                { path: 'mptDegree.degreeId', model: 'Degree' }
            ]
        })
        .populate('patientId')
        .sort({ createdAt: -1 });

        return res.status(200).json({
            message: 'Appointments fetched successfully',
            success: true,
            status: 200,
            data: appointments
        });

    } catch (error) {
        console.log("Error fetching today's appointments:", error);
        return res.status(500).json({
            message: 'Something went wrong, please try again',
            status: 500,
            success: false,
            error: error.message
        });
    }
};




// Appointment Complete by physio
exports.completeAppointment = async (req, res) => {
    console.log(req.body);

    try {
        const {
            appointmentId,
            prescriptionNotes,
            otp
        } = req.body;


        // Validate required fields
        if (!appointmentId) {
            return res.status(400).json({
                message: 'AppointmentId is required',
                success: false,
                status: 400
            });
        }

        const appointment = await Appointment.findById(appointmentId);
        console.log(appointment);


        if (!appointment) {
            return res.status(400).json({
                message: 'Appointment not found',
                success: false,
                status: 400
            });
        }

        console.log(req.body);

        if (appointment.otp === parseInt(otp)) {


            const patient = await Patient.findById(appointment.patientId);
            const physio = await Physio.findById(appointment.physioId).populate({
                path: 'subscriptionId',
                populate: { path: 'planId' }
            });

            if (!patient || !physio || !physio.subscriptionId || !physio.subscriptionId.planId) {
                return res.status(400).json({
                    message: 'Invalid patient or physio or subscription details',
                    success: false,
                    status: 400
                });
            }

            // Mark appointment as completed
            const updateAppointment = await Appointment.findByIdAndUpdate(
                appointmentId,
                {
                    prescriptionNotes: prescriptionNotes || null,
                    appointmentCompleted: true,
                    otpStatus: true,
                },
                { new: true }
            );

            // Increase patient count in subscription
            physio.subscriptionId.patientCount += 1;
            await physio.subscriptionId.save();

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
            if (physio.deviceId) {
                const physioData = {
                    title: "Consultation Completed",
                    body: `Your consultation with ${patient.fullName} has been completed successfully.`,
                    physioId: physio._id.toString(),
                    name: patient.fullName,
                    time: appointment.time,
                    date: appointment.date,
                    type: "appointment",
                    from: "admin",
                    to: "physio",
                    for: "physio",
                };

                const resultPhysio = await sendFCMNotification(physio.deviceId, physioData);
                if (!resultPhysio || resultPhysio.success === false) {
                    console.log("Error sending notification to physio", resultPhysio);
                }
            }

            // Send FCM notification to patient
            if (patient.deviceId) {
                const patientData = {
                    title: "Consultation Completed",
                    body: `Your consultation with ${physio.fullName} has been completed successfully.`,
                    name: physio.fullName,
                    patientId: patient._id.toString(),
                    type: "appointment",
                    from: "admin",
                    to: "patient",
                    for: "patient",
                };

                const resultPatient = await sendFCMNotification(patient.deviceId, patientData);
                if (!resultPatient || resultPatient.success === false) {
                    console.log("Error sending notification to patient", resultPatient);
                }
            }

            // Generate invoice and send chat message
            await createAppointmentInvoice(appointmentId);

            return res.status(200).json({
                message: 'Appointment Completed',
                success: true,
                status: 200,
                data: updateAppointment
            });
        }
        else {
            return res.status(400).json({
                message: 'Incorrect OTP',
                success: false,
                status: 400
            });

        }

    } catch (error) {
        console.error("Error in completeAppointment:", error.message);
        return res.status(500).json({
            message: 'Something went wrong. Please try again.',
            success: false,
            status: 500,
            error: error.message
        });
    }
};


exports.completeTreatment = async (req, res) => {
    try {
        const {
            appointmentId,
            prescriptionNotes,
        } = req.body;

        if (!appointmentId) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById({
            _id: appointmentId
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
            _id: appointmentId
        }, {
            prescriptionNotes: prescriptionNotes ? prescriptionNotes : null,
            otpStatus: true,
            'isTreatmentScheduled.isTreatmentCompleted': true,
        }, {
            new: true
        })

        // Fetch the patient and physio associated with the appointment
        const patient = await Patient.findById(appointment.patientId);
        const physio = await Physio.findById(appointment.physioId);

        const invoice = await createAppointmentInvoice(appointmentId, isTreatment = true);
        await sendChatMessage(physio._id, patient._id, invoice);

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

// Cash Appointment Payment
exports.cashAppointmentPayment = async (req, res) => {
    try {
        const { appointmentId } = req.query;



        // Check if the appointment exists
        const appointment = await Appointment.findOne({ _id: appointmentId });
        if (!appointment) {
            return res.status(401).send({
                message: "Appointment not found",
                status: 401,
                success: false
            });
        }

        // Check if the patient exists
        const patient = await Patient.findOne({ _id: appointment.patientId });
        if (!patient) {
            return res.status(401).send({
                message: "Patient not found",
                status: 401,
                success: false
            });
        }

        // Check if the physio exists
        const physio = await Physio.findOne({ _id: appointment.physioId }).populate({
            path: 'subscriptionId',
            populate: { path: 'planId' }
        });
        if (!physio) {
            return res.status(401).send({
                message: "Physio not found",
                status: 401,
                success: false
            });
        }

        // Check if the appointment is scheduled and not paid yet
        await Appointment.findOneAndUpdate(
            { _id: appointmentId },
            { $set: { isPaid: true, paymentStatus: 0, orderId: "paid" } },
            { new: true }
        );
        // return res.send({
        //     message: 'Cash payment successful',
        //     success: true,
        //     status: 200,
        //     data: appointment
        // })
        // Transaction details for the payment physio
        const planType = physio.subscriptionId.planId.planType
        if (patient.physioId == appointment.physioId) {

            const transaction = await Transaction.findByIdAndUpdate(
                appointment.transactionId,
                { paymentStatus: 'paid' },
                { new: true }
            );

            // Create the transaction for physio
            const transaction2 = new Transaction({
                appointmentId: appointment._id,
                physioId: appointment.physioId,
                amount: transaction.amount,
                planType: planType,
                transactionId: `PHCAS_${generateRandomCode()}`,
                physioTransactionType: 0,
                paymentMode: appointment.couponId ? 'cash/voucher' : 'cash',
                treatment: false,
                paymentStatus: 'paid',
                createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });
            await transaction2.save();

            // add amount to physio wallet
            const physio = await Physio.findById(appointment.physioId);
            await physio.findByIdAndUpdate(physio._id, { $inc: { wallet: appointment.amount } });

            res.status(200).json({
                message: 'Cash payment successfullll',
                success: true,
                status: 200,
                data: appointment
            });
        } else {

            const transaction = await Transaction.findByIdAndUpdate(
                appointment.transactionId,
                { paymentStatus: 'paid' },
                { new: true }
            );

            const planType = physio.subscriptionId.planId.planType
            const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

            // console.log("physio Plus", appointment.physioId);
            let amount = transaction.amount; // total amount
            let PlatformCharges = (amount * platformChargesPercentage) / 100; // platform charges
            let gst = (PlatformCharges * 18) / 100; //gst charges

            console.log("physio Plus", appointment.physioId);
            console.log("physio Plus 22%", PlatformCharges);
            console.log("gst 18%", gst);

            await Physio.findByIdAndUpdate(
                physio._id,
                {
                    $inc: { wallet: - (PlatformCharges + gst) },
                }
            );

            const transaction2 = new Transaction({
                appointmentId: appointment._id,
                physioId: appointment.physioId,
                amount: appointment.amount,
                transactionId: `PHCAS_${generateRandomCode()}`,
                physioTransactionType: 1,
                paymentMode: appointment.couponId ? 'cash/voucher' : 'cash',
                treatment: false,
                paymentStatus: 'paid',
                planType: planType,
                PlatformCharges: PlatformCharges,
                gst: gst,
                physioAmount: (PlatformCharges + gst),
                adminAmount: PlatformCharges,
                couponId: appointment.couponId,
                createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });
            await transaction2.save();

            res.status(200).json({
                message: 'Cash payment successfulooo',
                success: true,
                status: 200,
                data: transaction2
            });
        }

    } catch (error) {
        console.log(error.message, "Error");
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
}

// Get all appointments completed by physio
exports.getAppointmentsStatus = async (req, res) => {
    try {
        const {
            physioId,
            appointmentStatus
        } = req.query;

        // Validate physioId
        if (!physioId || physioId === 'null' || physioId.trim() === '') {
            return res.status(400).json({
                message: 'Valid physioId is required',
                success: false,
                status: 400
            });
        }

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

        const appointments = await Appointment.find({
            $and: [{
                physioId: physioId
            },
            {
                appointmentStatus: Number(appointmentStatus)
            }
            ]
        })
            .populate('physioId patientId')
            .populate({
                path: 'physioId',
                populate: {
                    path: 'specialization',
                    model: 'Specialization'
                }
            }).sort({ createdAt: -1 })

        return res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: appointments
        });
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong, please try again',
            success: false,
            status: 500,
            error: error.message
        });
    }
};

// Physio Amount debit
exports.debitPhysioAmount = async (req, res) => {
    try {
        const {
            appointmentId,
        } = req.body;

        if (!appointmentId) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById({
            _id: appointmentId
        });
        if (!appointment) return res.status(400).json({
            message: 'Appointment not found',
            success: false,
            status: 400
        });

        const physioId = appointment.physioId;
        const physio = await Physio.findById(physioId).populate({
            path: 'subscriptionId',
            populate: { path: 'planId' }
        });
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });

        const patientId = appointment.patientId;
        const patient = await Patient.findById(patientId);
        if (!patient) return res.status(400).json({
            message: 'Patient not found',
            success: false,
            status: 400
        });

        // Transaction details for the payment physio
        if (patient.physioId == appointment.physioId) {

            const transaction = await Transaction.findByIdAndUpdate(
                appointment.transactionId,
                { paymentStatus: 'paid' },
                { new: true }
            );

            // Create the transaction for physio
            const transaction2 = new Transaction({
                appointmentId: appointment._id,
                physioId: appointment.physioId,
                amount: transaction.amount,
                transactionId: `PHCAS_${generateRandomCode()}`,
                physioTransactionType: 0,
                paymentMode: 'cash',
                treatment: false,
                paymentStatus: 'paid',
                createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });
            await transaction2.save();

            // add amount to physio wallet
            const physio = await Physio.findById(appointment.physioId);
            await physio.findByIdAndUpdate(physio._id, { $inc: { wallet: appointment.amount } });

            res.status(200).json({
                message: 'Cash payment successful',
                success: true,
                status: 200,
                data: appointment
            });
        } else {

            const transaction = await Transaction.findByIdAndUpdate(
                appointment.transactionId,
                { paymentStatus: 'paid' },
                { new: true }
            );

            const planType = physio.subscriptionId.planId.planType
            const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

            // console.log("physio Plus", appointment.physioId);
            let amount = transaction.amount; // total amount
            let PlatformCharges = (amount * platformChargesPercentage) / 100; // platform charges
            let gst = (PlatformCharges * 18) / 100; //gst charges

            // console.log("physio Plus", appointment.physioId);
            // console.log("physio Plus 22%", PlatformCharges);
            // console.log("gst 18%", gst);

            await Physio.findByIdAndUpdate(
                physio._id,
                {
                    $inc: { wallet: - (PlatformCharges + gst) },
                }
            );

            const transaction2 = new Transaction({
                appointmentId: appointment._id,
                physioId: appointment.physioId,
                amount: appointment.amount,
                transactionId: `PHCAS_${generateRandomCode()}`,
                physioTransactionType: 1,
                paymentMode: 'cash',
                treatment: false,
                paymentStatus: 'paid',
                PlatformCharges: PlatformCharges,
                gst: gst,
                physioAmount: (PlatformCharges + gst),
                adminAmount: PlatformCharges,
                couponId: appointment.couponId,
                createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });


            // const transaction2 = new Transaction({
            //     appointmentId: appointment._id,
            //     physioId: appointment.physioId,
            //     amount: appointment.amount,
            //     physioTransactionType: 1,
            //     paymentMode: 'cash',  // ✅ Change 'offline' → 'cash'
            //     treatment: false,
            //     paymentStatus: 'paid',
            //     PlatformCharges: PlatformCharges,
            //     gst: gst,
            //     physioAmount: (PlatformCharges + gst),
            //     adminAmount: (PlatformCharges + gst), 
            //     couponId: appointment.couponId,
            //     createdAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            //     updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            // });
            await transaction2.save();


            res.status(200).json({
                message: 'Cash payment successful',
                success: true,
                status: 200,
                data: appointment
            });
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Something went wrong, please try again',
            success: false,
            status: 500
        })
    }
}

// send otp for patient appointment
exports.sendOtpToPhysio = async (req, res) => {
    try {
        const { patientId } = req.body;

        // if check if patientId and appointmentId is provided
        if (!patientId) {
            return res.status(400).json({
                message: "Patient ID  is required",
                status: 400,
                success: false,
            });
        }

        // Find patient
        const patient = await Patient.findById({ _id: patientId });
        if (!patient) {
            return res.status(400).json({
                message: "Patient not found",
                status: 400,
                success: false,
            });
        }

        // Send OTP to patient
        const response = await msg91otp.send(patient.phone);

        if (response.type === "success") {
            return res.status(200).json({
                message: "OTP sent successfully",
                status: 200,
                success: true,
            });
        }


    } catch (error) {
        console.error(error);
        res.json({
            status: false,
            message: "Error sending OTP"
        });
    }
};

// verify otp for patient appointment
exports.patientverifyOtp = async (req, res) => {
    try {
        const { otp, physioId, appointmentId } = req.body;

        // Check if OTP and patientId are provided
        if (!otp || !physioId) {
            return res.status(400).json({
                message: !otp ? "OTP is required" : "Physio ID is required",
                status: 400,
                success: false,
            });
        }

        // appointment 
        const appointment = await Appointment.findById(appointmentId)
        if (!appointment) {
            return res.status(400).json({
                message: "Appointment not found",
                status: 400,
                success: false,
            });
        }

        // Find patient
        const physio = await Physio.findById({ _id: physioId });
        if (!physio) {
            return res.status(400).json({
                message: "Physio not found",
                status: 400,
                success: false,
            });
        }

        if (!appointment.physioId == physio._id) {
            return res.status(400).json({
                message: "Appointment physio not match",
                status: 400,
                success: false,
            });
        }

        if (appointment.otp == otp) {
            // Update appointment status to confirmed


            return res.status(200).json({
                message: "OTP verified successfully",
                status: 200,
                success: true,
                data: appointment
            });

        } else {
            return res.status(400).json({
                message: "Invalid OTP",
                status: 400,
                success: false,
            });
        }

    } catch (error) {
        console.error(error);

        // Check for specific error types based on the error code and message
        if (error.code === 'BAD_REQUEST_DATA' && error.statusCode === 400) {
            let errorMessage = "Error verifying OTP";

            if (error.message.includes("OTP expired")) {
                errorMessage = "OTP expired, please request a new one";
            } else if (error.message.includes("OTP not match")) {
                errorMessage = "OTP does not match, please try again";
            }

            return res.status(400).json({
                message: errorMessage,
                status: 400,
                success: false,
            });
        }

        res.status(500).json({
            message: "Error verifying OTP",
            status: 500,
        });
    }
};


exports.treatmentSchedule = async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
                message: "Invalid or missing request body",
                status: 400,
                success: false
            });
        }

        console.log("Received request body:", req.body);

        const {
            physioId,
            appointmentId,
            date,
            startTime,
            endTime,
            treatmentAmount,
        } = req.body;

        // Validation checks
        if (!appointmentId) {
            return res.status(400).send({
                message: "AppointmentId is required",
                status: 400,
                success: false
            });
        }

        if (!physioId) {
            return res.status(400).send({
                message: "PhysioId is required",
                status: 400,
                success: false
            });
        }

        if (!date) {
            return res.status(400).send({
                message: "Date is required",
                status: 400,
                success: false
            });
        }

        if (!startTime) {
            return res.status(400).send({
                message: "Start time is required",
                status: 400,
                success: false
            });
        }

        if (!endTime) {
            return res.status(400).send({
                message: "End time is required",
                status: 400,
                success: false
            });
        }

        if (!treatmentAmount) {
            return res.status(400).send({
                message: "Treatment amount is required",
                status: 400,
                success: false
            });
        }

        // Ensure date is in array format
        let dateArray;
        if (typeof date === 'string') {
            dateArray = date.split(',').map(d => d.trim());
        } else if (Array.isArray(date)) {
            dateArray = date;
        } else {
            return res.status(400).send({
                message: "Invalid date format",
                status: 400,
                success: false
            });
        }

        // Validate physioId
        if (!mongoose.Types.ObjectId.isValid(physioId)) {
            return res.status(400).send({
                message: "Invalid PhysioId format",
                status: 400,
                success: false
            });
        }

        // Find appointment
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).send({
                message: "Appointment not found",
                status: 404,
                success: false,
            });
        }

        // Prevent duplicate scheduling
        if (appointment.isTreatmentScheduled?.treatmentDate?.length > 0) {
            return res.status(400).send({
                message: "Treatment already scheduled",
                status: 400,
                success: false
            });
        }

        const totalDays = dateArray.length;

        // Fetch patient and physio
        const patient = await Patient.findById(appointment.patientId);
        const physio = await Physio.findById(appointment.physioId);

        // Prepare treatment entries
        const treatmentEntries = dateArray.map(d => ({
            date: d,
            isPaid: false,
            paymentMode: null
        }));

        // Save treatment data
        appointment.isTreatmentScheduled = {
            isTreatmentRequest: true,
            treatmentDate: treatmentEntries,
            startTime: startTime,
            endTime: endTime,
            amount: treatmentAmount,
            status: 0 // 0 - booked
        };

        appointment.appointmentStatus = 1;
        appointment.otpStatus = true;

        await appointment.save();

        // Send Notifications
        if (patient?.deviceId && physio?.deviceId) {
            const dataToPhysio = {
                title: "Treatment Scheduled",
                body: `You have successfully created a treatment with ${patient.fullName} for ${totalDays} days`,
                physioId: physio._id.toString(),
                name: patient.fullName,
                time: appointment.time,
                date: appointment.date,
                type: 'treatment',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            };

            const resultToPhysio = await sendFCMNotification(physio.deviceId, dataToPhysio);
            if (!resultToPhysio.success) {
                console.log("Error sending notification to physio", resultToPhysio.error);
            }

            const dataToPatient = {
                title: "Treatment Scheduled",
                body: `Your treatment for ${totalDays} days has been scheduled.`,
                patientId: patient._id.toString(),
                name: physio.fullName,
                type: 'treatment',
                from: 'admin',
                to: 'patient',
                for: 'patient'
            };

            const resultToPatient = await sendFCMNotification(patient.deviceId, dataToPatient);
            if (!resultToPatient.success) {
                console.log("Error sending notification to patient", resultToPatient.error);
            }
        }

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




// this method is reScheduleTreatments by physio 
exports.reScheduleTreatment = async (req, res) => {

    console.log("req.bod");


    try {
        const { appointmentId, treatmentIds, updatedDates } = req.body;

        if (!Array.isArray(treatmentIds) || !Array.isArray(updatedDates)) {
            return res.status(400).json({
                message: "Please provide proper arrays of treatmentIds and updatedDates.",
                status: 400,
                success: false
            });
        }

        if (!appointmentId || treatmentIds.length !== updatedDates.length) {
            return res.status(402).json({
                message: "appointmentId, treatmentIds, and updatedDates are required and must be of equal length.",
                status: 402,
                success: false
            });
        }

        const updatedDateResult = [];

        const checkAppointment = await Appointment.findById(appointmentId);

        if (!checkAppointment) {
            return res.status(404).json({
                message: "No appointment exists for this ID.",
                status: 404,
                success: false
            });
        }

        for (let i = 0; i < treatmentIds.length; i++) {
            const singleTreatmentId = treatmentIds[i];
            const newDate = updatedDates[i];

            const treatment = checkAppointment.isTreatmentScheduled.treatmentDate.find(
                t => t._id.toString() === singleTreatmentId
            );

            if (treatment) {
                treatment.date = newDate; // ensure Date object
                treatment.isRescheduled = true;

                updatedDateResult.push({
                    _id: singleTreatmentId,
                    updatedDate: newDate,
                    updated: true
                });
            } else {
                updatedDateResult.push({
                    _id: singleTreatmentId,
                    error: "Treatment not found"
                });
            }
        }

        checkAppointment.isTreatmentScheduled.treatmentDate.sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        await checkAppointment.save();

        const { physio, patient } = await Promise.all([
            Physio.findById(checkAppointment.physioId),
            Physio.findById(checkAppointment.patient)
        ])

        console.log(req.body);



        if (physio && patient) {

            const data = {
                title: "Upcoming consultation!",
                body: `You have upcoming ${serviceType} consultation`,
                serviceType: serviceType,
                physioId: physio._id.toString(),
                type: 'treatment',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            // Send Notification to Physio
            let result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }

            // Send Notification to Patient
            data = {}
            data.name = physio.fullName
            data.type = 'treatment'
            data.from = 'admin'
            data.to = 'patient'
            data.for = 'patient'
            data.physioId = null
            data.patientId = patient._id.toString(),
                result = await sendFCMNotification(patient.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to patient", result);
            }
        }

        return res.status(200).json({
            message: "Treatment dates updated and sorted successfully.",
            updatedDateResult,
            updatedAppointment: checkAppointment,
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error: " + error.message,
            status: 500,
            success: false
        });
    }
};


// Get Single Appointment 
exports.singleAppointment = async (req, res) => {
    try {

        const appointmentId = req.query.appointmentId;

        const appointment = await Appointment.findById(appointmentId)
            .populate('physioId patientId')
            .populate({
                path: 'physioId',
                populate: [
                    {
                        path: 'specialization',
                        model: 'Specialization'
                    },
                    {
                        path: 'bptDegree.degreeId',
                        model: 'Degree'
                    },
                    {
                        path: 'mptDegree.degreeId',
                        model: 'Degree'
                    },
                    {
                        path: 'degree.degreeId',
                        model: 'Degree'
                    },
                    {
                        path: 'subscriptionId',
                        model: 'Subscription'
                    },
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
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};


exports.addIsRehab = async (req, res) => {
    try {
        const {
            physioId,
            appointmentId,
            rehabDate,
            startTime,
            endTime,
            treatmentAmount,
            prescriptionNotes,
            treatmentServiceType
        } = req.body;

        // Cast the fields to the correct data types
        const amount = Number(treatmentAmount);

        if (!physioId || !appointmentId || !rehabDate || !startTime || !endTime || isNaN(amount) || !treatmentServiceType) {
            return res.status(400).send({
                message: "All required fields must be provided",
                status: 400,
                success: false
            });
        }

        const appointments = await Appointment.findById({
            _id: appointmentId,
            physioId,

        });

        if (!appointments) {
            return res.status(404).send({
                message: "Appointment not found...",
                status: 404,
                success: false
            });
        }

        // Check if isRehab already exists
        if (appointments.isRehab && Object.keys(appointments.isRehab).length > 0) {
            return res.status(400).send({
                message: "Rehab already exists for this appointment",
                status: 400,
                success: false
            });
        }

        // let dateArray;
        let dataArray;
        // Check if date is a string or array
        if (typeof rehabDate === 'string') {
            dataArray = rehabDate.split(',');

        } else if (Array.isArray(rehabDate)) {
            dataArray = rehabDate;
        } else {
            return res.status(400).send({
                message: "Invalid date format",
                status: 400,
                success: false
            });
        }

        const appointment = await Appointment.findOneAndUpdate({
            _id: appointmentId
        }, {
            $push: {
                isRehab: {
                    rehabDate: dataArray.map(date => ({
                        date: date,
                    })), // Ensure date is a Date object
                    startTime: startTime,
                    endTime: endTime,
                    amount: amount, // Cast to number
                    prescriptionNotes: prescriptionNotes,
                    treatmentServiceType: Number(treatmentServiceType)
                },
            },
            appointmentCompleted: false,
            isRehabStatus: false,
            appointmentStatus: 2
        }, {
            new: true
        });




        return res.send({
            message: "Rehab added successfully",
            status: 200,
            success: true,
            appointment: appointment
        });

    } catch (error) {
        console.log(error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message
        });
    }
};


exports.treatmentPayment = async (req, res) => {
    try {
        const {
            dateId, physioId, appointmentId
        } = req.body;

        if (!physioId || !appointmentId || !dateId) {
            return res.status(400).send({
                message: "All required fields must be provided",
                status: 400,
                success: false
            });
        }

        const physio = await Physio.findById(physioId).populate({
            path: 'subscriptionId',
            populate: { path: 'planId' }
        });
        if (!physio) {
            return res.status(404).send({
                message: "Physio not found...",
                status: 404,
                success: false
            });
        }
        const appointment = await Appointment.findOne({
            _id: appointmentId,
            physioId
        }).populate('patientId');

        if (!appointment) {
            return res.status(404).send({
                message: "Appointment not found...",
                status: 404,
                success: false
            });
        }

        // Convert `dateId` to an array if it's a single ID
        const dateIds = Array.isArray(dateId) ? dateId : [dateId];
        const updatedTreatmentDates = [];


        const patient = await Patient.findById(appointment.patientId);
        if (!patient) {
            return res.status(404).send({
                message: "Patient not found...",
                status: 404,
                success: false
            });
        }

        for (const id of dateIds) {
            // Find the treatment date by ID
            const treatmentDate = appointment.isTreatmentScheduled.treatmentDate.find(
                treatment => treatment._id.toString() === id
            );

            if (!treatmentDate) {
                return res.status(404).send({
                    message: `Treatment date with ID ${id} not found...`,
                    status: 404,
                    success: false
                });
            }

            // Mark the specific treatment date as paid and set paymentStatus
            treatmentDate.isPaid = true;
            treatmentDate.paymentStatus = 1; // 1 - offline payment
            updatedTreatmentDates.push(treatmentDate);

            // Check if transactionId exists before updating
            if (treatmentDate.transactionId) {
                await Transaction.findByIdAndUpdate(
                    treatmentDate.transactionId,
                    { paymentStatus: 'paid' },
                    { new: true }
                );
            }
        }
        await appointment.save();

        const debitAmount = appointment.isTreatmentScheduled.amount * dateId.length;
        let commission = (25.9 / 100) * debitAmount;
        commission = parseFloat(commission.toFixed(2))

        const planType = physio.subscriptionId.planId.planType
        const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

        let amount = appointment.isTreatmentScheduled.amount * dateId.length; // total amount
        let PlatformCharges = (amount * platformChargesPercentage) / 100; // platform charges
        let gst = (PlatformCharges * 18) / 100; //gst charges

        const physioWallet = await Physio.findByIdAndUpdate(
            physioId,
            { $inc: { wallet: - (PlatformCharges + gst) } },
            { new: true }
        );

        const paidDates = (appointment?.isTreatmentScheduled?.treatmentDate || []).filter(e =>
            dateIds.some(id => e._id.equals(id))
        ).map(e => e.date);


        const transaction = await Transaction.create({
            physioId: physioId,
            patientId: appointment.patientId,
            appointmentId: appointment._id,
            appointmentAmount: appointment?.isTreatmentScheduled?.amount,
            amount: amount,
            transactionId: `PHCAS_${generateRandomCode()}`,
            physioTransactionType: "credit",
            paymentStatus: "paid",
            paymentMode: "cash",
            paidTo: "physio",
            paidFor: "treatment",
            treatment: true,
            paidForDates: paidDates,
            platformCharges: PlatformCharges,
            gstAmount: gst,
            physioPlusAmount: PlatformCharges,
            physioAmount: (amount - (PlatformCharges + gst)),
        });

        // const treatmentTransaction = new Transaction({
        //     transactionId: `PHCAS_${generateRandomCode()}`,
        //     appointmentId: appointment._id,
        //     physioId: physioId,
        //     patientId: appointment.patientId,
        //     amount: amount,
        //     physioTransactionType: 1,
        //     paymentMode: 'cash',
        //     treatment: true,
        //     paymentStatus: 'paid',
        //     paidForDates: paidDates,
        //     PlatformCharges: PlatformCharges,
        //     gst: gst,
        //     physioAmount: (amount - (PlatformCharges + gst)),
        //     adminAmount: PlatformCharges,
        // });

        // await treatmentTransaction.save();

        const cacheKey = CashBackCacheKey()
        let patientCount = await redisClient.get(cacheKey)
        patientCount = parseInt(patientCount) || 0

        let CashBackData = null;
        //  finding treatment transaction check if multiple treatment transaction then they are not eligible for cashback
        const CheckTransaction = await Transaction.find({ appointmentId: appointment._id, paidFor: 'treatment' }).countDocuments()
        const allPaid = appointment.isTreatmentScheduled.treatmentDate.every((obj) => obj.isPaid === true)

        if (allPaid && CheckTransaction === 1) {
            // console.log('all paid' + allPaid + patientCount);

            patientCount += 1

            const result = await sendFCMNotification(patient.deviceId, {
                patientId: patient._id.toString(),
                title: 'Payment Confirmed',
                body: 'Your payment is successful, and you have received a scratch card',
                type: 'treatment',
                from: 'admin',
                to: 'patient',
                for: 'patient',
                name: patient.fullName.toString()
            })

            if (!result) console.log("Error sending notification to physio");

            let obj = {
                userId: appointment.patientId || null,
                appointmentId: appointment._id || null,
                transactionId: transaction._id || null
            }

            if (patientCount === 15) {
                obj.rewardPercentage = "70%",
                    obj.rewardAmount = (Number(amount || 0) * 70) / 100,
                    CashBackData = await GiveCashBack(obj);
                patientCount = 0
            }
            else {

                obj.rewardPercentage = "5%",
                    obj.rewardAmount = (Number(amount || 0) * 5 / 100)
                CashBackData = await GiveCashBack(obj)
            }

            await redisClient.set(cacheKey, patientCount)

        }
        const result = await sendFCMNotification(physio.deviceId, {
            physioId: physio._id.toString(),
            title: 'Payment Confirmed',
            body: `Your treatment payment has been confirmed with ${patient?.fullName ?? "the patient"}`,
            type: 'treatment',
            from: 'admin',
            to: 'physio',
            for: 'physio',
            name: physio.fullName.toString()
        })

        if (!result) console.log("Error sending notification to physio");
        return res.status(200).send({
            message: "Treatment payment successfully processed",
            status: 200,
            success: true,
            updatedDates: updatedTreatmentDates,
            amount: appointment.isTreatmentScheduled.amount
        });

    } catch (error) {
        console.error("Error in treatment payment:", error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error.message || error
        });
    }
};


// Appointment reschedule by physio
exports.rescheduleAppointment = async (req, res) => {
    try {
        const {
            appointmentId,
            date,
            time,
            timeInString
        } = req.body;

        if (!appointmentId) {
            return res.status(400).json({
                message: 'appointmentId is required',
                success: false,
                status: 400
            });
        }

        if (!date || !time || !timeInString) {
            return res.status(400).json({
                message: 'date, time, and timeInString are required',
                success: false,
                status: 400
            });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found",
                success: false,
                status: 404
            });
        }

        await Appointment.findByIdAndUpdate(appointmentId, {
            $set: {
                date,
                time,
                timeInString,
                isRescheduled: true
            }
        });

        // Fetch the patient and physio associated with the appointment
        const patient = await Patient.findById(appointment.patientId);
        const physio = await Physio.findById(appointment.physioId);

        // Send notification to the patient
        if (patient?.deviceId && physio?.deviceId) {
            const data = {
                title: 'Consultation Rescheduled',
                body: `Your consultation with ${physio?.fullName} has been rescheduled to ${date} at ${time}.`,
                patientId: patient._id.toString(),
                type: 'appointment',
                from: 'admin',
                to: 'patient',
                for: 'patient'
            }

            // send notifications to patient
            let result = await sendFCMNotification(patient.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }
        }

        return res.status(200).json({
            message: "Appointment rescheduled successfully",
            success: true,
            status: 200
        });


    } catch (error) {
        console.log("Error in rescheduleAppointment:", error)
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};


// get appointment Completed
exports.getCompletedAppointments = async (req, res) => {
    try {

        const { physioId, appointmentStatus } = req.query;

        if (!physioId) {
            return res.status(400).json({
                message: 'physioId is required',
                success: false,
                status: 400
            });
        }

        if (!appointmentStatus) {
            return res.status(400).json({
                message: 'appointmentStatus is required',
                success: false,
                status: 400
            });
        }

        // check physioId
        const physio = await Physio.findOne({ _id: physioId });
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        const completedAppointments = await Appointment.find({
            physioId,
            appointmentStatus: appointmentStatus
        }).populate('patientId');

        return res.status(200).json({
            message: 'Completed Appointments',
            status: 200,
            success: true,
            data: completedAppointments
        });

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false,
            error: error.message
        })
    }
};

exports.getTreatedPatients = async (req, res) => {
    try {
        const { physioId, serviceType } = req.query;

        if (!physioId) {
            return res.status(400).json({
                message: 'physioId is required',
                success: false,
                status: 400
            });
        }

        if (!serviceType) {
            return res.status(400).json({
                message: 'serviceType is required',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findOne({ _id: physioId });
        if (!physio) {
            return res.status(404).json({
                message: 'Physio not found',
                success: false,
                status: 404
            });
        }

        const completedAppointments = await Appointment.find({
            physioId,
            serviceType,
            appointmentCompleted: true
        })

        return res.status(200).json({
            message: 'Completed Appointments',
            status: 200,
            success: true,
            data: completedAppointments
        });

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
            error: error.message
        })
    }
};