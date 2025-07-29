const Appointment = require('../../models/appointment');
const Patient = require('../../models/patient');
const Physio = require('../../models/physio');
const CashBack = require('../../models/cashBack');
const moment = require('moment');
const Razorpay = require('razorpay');
require('dotenv').config();
const Transaction = require('../../models/transaction');
const Coupon = require('../../models/coupon');
const { sendFCMNotification } = require('../../services/fcmService');
const generateRandomCode = require('../../utility/generateRandomCode');
const PhysioHelper = require('../../utility/physioHelper');
const sendAppointmentEmail = require('../../services/sendEmail');
const Chat = require('../../models/chatroom');
const Plan = require('../../models/plan');
const Subscription = require('../../models/subscription');
const notification = require('../../models/notification');
const invoice = require('../../models/invoice');
const mongoose = require('mongoose');
const { CashBackCacheKey, GiveCashBack } = require('../../utility/cashBackUtility');
const { redisClient } = require('../../utility/redisClient');
var instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const generateRandomOTP = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

// cash Appointment
exports.createAppointment = async (req, res) => {
    try {
        // let toDate = moment().format("yyyy-MM-DDTHH:mm:ss.SSSSSS")
        // 2024-07-31T00:00:00.000000
        // console.log(toDate);
        const {
            patientId,
            physioId,
            date,
            time,
            patientName,
            age,
            gender,
            phone,
            painNotes,
            amount,
            serviceType,
            timeInString,
            couponId
        } = req.body;

        // console.log(req.body, "Body");

        if (!patientId) return res.status(400).json({
            message: 'PatientId is required',
            success: false,
            status: 400
        });
        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });
        if (!date) return res.status(400).json({
            message: 'Date is required',
            success: false,
            status: 400
        });
        if (!time) return res.status(400).json({
            message: 'Time is required',
            success: false,
            status: 400
        });
        if (!patientName) return res.status(400).json({
            message: 'Patient Name is required',
            success: false,
            status: 400
        });
        if (!age) return res.status(400).json({
            message: 'Age is required',
            success: false,
            status: 400
        });

        if (!phone) return res.status(400).json({
            message: 'Phone is required',
            success: false,
            status: 400
        });

        if (!amount) return res.status(400).json({
            message: 'Amount is required',
            success: false,
            status: 400
        });

        if (!timeInString) return res.status(400).json({
            message: 'Time In String is required',
            success: false,
            status: 400
        });

        const patient = await Patient.findById(patientId);
        if (!patient) return res.status(400).json({
            message: 'Patient not found',
            success: false,
            status: 400
        });

        const physio = await Physio.findById(physioId).populate({
            path: 'subscriptionId',
            populate: { path: 'planId' }
        });
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
        });

        // if couponId is present then check the coupon is valid or not
        if (couponId) {
            const coupon = await Coupon.findById({ _id: couponId });
            if (!coupon) return res.status(400).json({
                message: 'Coupon not found',
                success: false,
                status: 400
            });
        }

        // if check seam time appointment is already booked or not
        const checkAppointment = await Appointment.findOne({
            physioId,
            date,
            time
        });
        if (checkAppointment) return res.status(400).json({
            message: 'Appointment already booked',
            success: false,
            status: 400
        });

        const appointment = new Appointment({
            patientId,
            physioId,
            status: 0,
            date,
            time,
            patientName,
            age,
            gender,
            phone: `+91${phone}`,
            painNotes,
            amount,
            otp: Number(generateRandomOTP()),
            serviceType: serviceType, // 0-home, 1-clinic, 2-online
            timeInString,
            bookingSource: "website",
            couponId: couponId ? couponId : null,
        });
        await appointment.save();

        // Send notification to the physio
        if (physio) {
            const data = {
                title: patient.fullName,
                body: `You have a new consultation from ${patient.fullName}`,
                physioId: physio._id.toString(),
                type: 'appointment',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            const result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }
        }

        // Create the transaction
        const planType = physio.subscriptionId.planId.planType
        const transaction = new Transaction({
            appointmentId: appointment._id,
            patientId: appointment.patientId,
            physioId: appointment.physioId,
            amount: amount,
            transactionId: `PHCAS_${generateRandomCode()}`,
            patientTransactionType: 1,
            planType: planType,
            // transactionType: 0,
            paymentMode: 'cash',
            treatment: false,
            paymentStatus: 'pending'
        });
        await transaction.save();

        appointment.transactionId = transaction._id;
        await appointment.save();

        res.status(201).json({
            message: 'Appointment created',
            success: true,
            status: 201,
            data: appointment
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500,
            error: error.message
        });
    }
};

exports.getAppointment = async (req, res) => {
    try {
        // Get all appointments of a physio by physioId and date
        const {
            physioId,
            date,
            serviceType
        } = req.query;

        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });

        if (!date) return res.status(400).json({
            message: 'Date is required',
            success: false,
            status: 400
        });
        // console.log(physioId,"ID");
        let physio = await Physio.findById(Object(physioId.trim()));
        // return console.log(physio);
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });

        // get date from query
        let startDay = moment(date, "YYYY-MM-DDTHH:mm:ss.SSSSSS").startOf('day').format("YYYY-MM-DDTHH:mm:ss.SSSSSS");
        let endDay = moment(date, "YYYY-MM-DDTHH:mm:ss.SSSSSS").endOf('day').format("YYYY-MM-DDTHH:mm:ss.SSSSSS");

        const appointments = await Appointment.find(
            // data fatcching from database by physioId and date of ondate
            {
                physioId: physio._id,
                serviceType: serviceType,
                date: {
                    $gte: startDay,
                    $lt: endDay
                }
            }
        );

        res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: appointments
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
}


// Appointment with razorpay payment gateway
exports.createAppointmentRazorpay = async (req, res) => {
    try {
        const {
            patientId,
            physioId,
            date,
            time,
            patientName,
            age,
            appointmentAddress,
            gender,
            phone,
            painNotes,
            amount,
            serviceType,
            timeInString,
            couponId
        } = req.body;

        console.log(req.body);


        if (!patientId) return res.status(400).json({
            message: 'PatientId is required',
            success: false,
            status: 400
        });
        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });
        if (!date) return res.status(400).json({
            message: 'Date is required',
            success: false,
            status: 400
        });
        if (!time) return res.status(400).json({
            message: 'Time is required',
            success: false,
            status: 400
        });
        if (!patientName) return res.status(400).json({
            message: 'Patient Name is required',
            success: false,
            status: 400
        });
        if (!age) return res.status(400).json({
            message: 'Age is required',
            success: false,
            status: 400
        });

        if (!phone) return res.status(400).json({
            message: 'Phone is required',
            success: false,
            status: 400
        });

        if (!amount) return res.status(400).json({
            message: 'Amount is required',
            success: false,
            status: 400
        });
        if (serviceType === "home" && !appointmentAddress) {
            return res.status(400).json({
                message: 'Address is required for home service',
                success: false,
                status: 400
            });
        }




        if (!timeInString) return res.status(400).json({
            message: 'Time In String is required',
            success: false,
            status: 400
        });

        const patient = await Patient.findById(patientId);
        if (!patient) return res.status(400).json({
            message: 'Patient not found',
            success: false,
            status: 400
        });


        const physio = await Physio.findById(physioId);
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });

        // if couponId is present then check the coupon is valid or not
        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (!coupon) return res.status(400).json({
                message: 'Coupon not found',
                success: false,
                status: 400
            });
        }

        // if check seam time appointment is already booked or not
        const checkAppointment = await Appointment.findOne({
            physioId,
            date,
            time
        });
        if (checkAppointment) return res.status(400).json({
            message: 'Appointment already booked',
            success: false,
            status: 400
        });

        var options = {
            amount: amount * 100,  // amount in the smallest currency unit
            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                patientId,
                physioId,
                date,
                time,
                patientName,
                age,
                gender,
                phone,
                painNotes,
                amount,
                appointmentAddress: serviceType == "home" && appointmentAddress,
                appointmentAmount: serviceType ? physio.clinic.charges : physio.home.charges,
                serviceType: serviceType,
                timeInString,
                couponId: couponId ? couponId : null
            }
        };

        const data = await instance.orders.create(options);
        // if couponId is given then update 
        await Coupon.findByIdAndUpdate(couponId, {
            $inc: { usageCount: 1 },
            ...(couponId === "67fcdc2d59a910171e3d4541" && {
                $addToSet: { patientId: patientId }
            })
        })

        const chats = await Chat.find({
            patientId,
            physioId
        })

        if (chats.length === 0) {
            const chat = new Chat({
                patientId,
                physioId
            })
            await chat.save()
        }
        else {
            console.log("already chats created ");
        }

        if (patient) {
            // Update the patient document with the new appointment address
            if (patient.appointmentAddress !== appointmentAddress.toString()) {
                patient.appointmentAddress = appointmentAddress;
            }

            // Check if address already exists in patientAddresses
            let isAddressExists = patient.patientAddresses.some((entry) => {
                return entry.appointmentAddress === appointmentAddress.toString();
            });

            // If not, push the new address
            if (!isAddressExists) {
                patient.patientAddresses.push({
                    appointmentAddress: appointmentAddress.toString()
                });
            }
            await patient.save()
        }
        res.status(200).json({
            message: 'Appointment created',
            success: true,
            status: 200,
            data: data
        });



    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
}

// Appointment with razorpay payment gateway
exports.verifyRazorpayPayment = async (req, res) => {
    try {
        const { orderId, appointmentAddress } = req.body;

        if (!orderId) return res.status(400).json({
            message: 'orderId is required',
            success: false,
            status: 400
        });

        const payment = await instance.orders.fetch(orderId);
        const patient = await Patient.findById(payment.notes.patientId)
        const physio = await Physio.findById(payment.notes.physioId).populate({
            path: 'subscriptionId',
            populate: { path: 'planId' }
        });

        // NOTE: Remove this after 5th May 2026 (After 1 Year)
        // This was added to avoid subscription plan issue for physio on boarded from admin
        // If planType is not present then add free subscription plan to physio
        let planType = physio.subscriptionId?.planId?.planType
        if (!physio.subscriptionId) {
            const freePlanId = "6744541c4409ca5b2a5d9316";
            const plan = await Plan.findById(freePlanId);

            if (!plan) {
                return res.status(400).json({
                    message: "plan not found",
                    status: 400,
                    success: false,
                });
            }

            const savedSubscription = await Subscription.create({
                physioId: physio._id,
                planId: plan._id,
                amount: 0,
                patientLimit: plan.patientLimit || 4,
                expireAt: moment().add(plan.planMonth, 'months').toDate()
            });

            const updatedPhysio = await Physio.findByIdAndUpdate(physio._id, {
                $set: {
                    subscriptionId: savedSubscription._id,
                    subscriptionCount: physio.subscriptionCount + 1
                }
            }, {
                new: true
            }).populate({
                path: 'subscriptionId',
                populate: { path: 'planId' }
            });

            planType = updatedPhysio.subscriptionId.planId.planType;
        }

        if (payment.status === 'paid') {
            const appointment = new Appointment({
                patientId: payment.notes.patientId,
                physioId: payment.notes.physioId,
                amount: payment.notes.amount,
                otp: Number(generateRandomOTP()),
                status: 0,
                planType: planType,
                date: payment.notes.date,
                time: payment.notes.time,
                patientName: payment.notes.patientName,
                age: payment.notes.age,
                gender: payment.notes.gender,
                phone: payment.notes.phone,
                painNotes: payment.notes.painNotes,
                serviceType: payment.notes.serviceType,
                timeInString: payment.notes.timeInString,
                orderId: payment.id,
                paymentStatus: 1,
                bookingSource: "website",
                couponId: payment.notes.couponId ? payment.notes.couponId : null,
                adminAmount: payment.notes.amount

            });

            // we are maintain amount after coupon code apply
            // if (payment.notes.couponId) {
            //     amount = await PhysioHelper.getOriginalAmount(payment.notes.couponId, payment.amount);
            // } else {
            //     amount = payment.amount / 100;
            // }
            const amount = payment.notes.appointmentAmount
            const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);
            let PlatformCharges = (amount * platformChargesPercentage) / 100; // platform charges
            let gst = (PlatformCharges * 18) / 100; //gst charges

            await Physio.findByIdAndUpdate(
                physio._id,
                {
                    $inc: { wallet: (amount - (PlatformCharges + gst)) },
                }
            );

            const transaction = new Transaction({
                orderId: payment.id,
                transactionId: `PHONL_${generateRandomCode()}`,
                appointmentId: appointment._id,
                patientId: payment.notes.patientId,
                physioId: payment.notes.physioId,
                couponId: payment.notes.couponId ? payment.notes.couponId : null,
                amount: payment.amount !== 0 ? payment.amount / 100 : 0,// for convert rupee,
                appointmentAmount: payment.notes.appointmentAmount,
                physioTransactionType: "debit",
                paymentMode: 'online',
                paymentStatus: 'paid',
                paidTo: "physio",
                paidFor: "appointment",
                gstAmount: gst,
                platformCharges: PlatformCharges,
                physioPlusAmount: PlatformCharges,
            });
            await transaction.save();
            appointment.transactionId = transaction._id
            await appointment.save();

            // Send Email to Admin
            let data = {
                patientName: patient.fullName,
                physioName: physio.fullName,
                amount: appointment.amount,
                physioPhone: physio.phone,
                patientPhone: patient.phone,
                date: appointment.date,
                time: appointment.time,
                timeInString: appointment.timeInString
            }

            sendAppointmentEmail({ data: data }).catch(e => console.error("Error sending email:", e));

            let result = { success: false }
            const serviceType = ["Home", "Clinic", "Online"][appointment.serviceType]

            data = {
                title: "Upcoming consultation!",
                body: `You have upcoming ${serviceType} consultation`,
                serviceType: serviceType,
                physioId: physio._id.toString(),
                name: patient.fullName.toString(),
                time: appointment.time,
                date: appointment.date,
                type: 'appointment',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            // Send Notification to Physio
            result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);

                await notification.create({
                    physioId: physio._id,
                    title: data.title,
                    message: data.body,
                    type: 'appointment',
                    from: 'admin',
                    to: 'physio',
                    for: 'physio',
                })
            }

            // Send Notification to Patient
            result.success = false
            data = {}
            data.title = "Upcoming consultation!",
                data.body = `You have upcoming ${serviceType} consultation`,
                data.type = 'appointment',
                data.from = 'admin',
                data.to = 'patient',
                data.for = 'patient'
            data.name = physio.fullName.toString()
            data.patientId = patient._id.toString()
            result = await sendFCMNotification(patient.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to patient", result);

                await notification.create({
                    patientId: patient._id,
                    title: data.title,
                    message: data.body,
                    type: 'appointment',
                    from: 'admin',
                    to: 'patient',
                    for: 'patient'
                })
            }
            res.status(200).json({
                message: 'Appointment created',
                success: true,
                status: 200,
                data: appointment
            });
        }
        else {

            res.status(400).json({
                message: 'Payment not successful',
                success: false,
                status: 400
            });
        }

    } catch (error) {

        console.log(error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500,
            error: error.message
        });
    }
};


// Get Appointment by patientId
exports.getAppointmentByPatientId = async (req, res) => {
    try {
        const patientId = req.query.patientId;

        if (!patientId) return res.status(400).json({
            message: 'PatientId is required',
            success: false,
            status: 400
        });

        let appointments = await Appointment.find({
            patientId: patientId
        }).populate("patientId physioId  couponId").populate({ path: 'physioId', populate: { path: 'specialization' } });


        const modifiedAppointments = await Promise.all(
            appointments.map(async (apt) => {
                const aptObj = apt.toObject(); // convert to plain JS object

                if (apt.isTreatmentScheduled.isTreatmentCompleted) {
                    const PatientInvoice = await invoice.findOne({ appointmentId: apt._id, type: "treatment" });
                    if (PatientInvoice) {
                        aptObj.invoice = PatientInvoice;
                    }
                }
                else if (apt.appointmentCompleted) {
                    const PatientInvoice = await invoice.findOne({ appointmentId: apt._id, type: "appointment" });
                    if (PatientInvoice) {
                        aptObj.invoice = PatientInvoice;
                    }

                }

                return aptObj;
            })
        );


        res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: modifiedAppointments
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
}

exports.getAppointmentByPhysioId = async (req, res) => {

    try {

        const { physioId } = req.query
        if (!physioId) {
            return res.status(400).json({
                message: "physioId is required",
                success: false
            })
        }

        const appointments = await Appointment.find({ physioId }).populate({
            path: 'physioId',
            populate: [
                { path: 'specialization', model: 'Specialization' },
                { path: 'subscriptionId', model: 'Subscription' },
                { path: 'degree.degreeId', model: 'Degree' },
                { path: 'bptDegree.degreeId', model: 'Degree' },
                { path: 'mptDegree.degreeId', model: 'Degree' }
            ]
        }).populate('patientId');
        const modifiedAppointments = await Promise.all(
            appointments.map(async (apt) => {
                const aptObj = apt.toObject(); // convert to plain JS object

                if (apt.appointmentCompleted) {
                    const PhysioInvoice = await invoice.findOne({ appointmentId: apt._id });
                    if (PhysioInvoice) {
                        aptObj.invoice = PhysioInvoice;
                    }
                }

                return aptObj;
            })
        );

        res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: modifiedAppointments
        });


    } catch (error) {
        res.status(200).json({
            message: 'internal Server Error' + error,
            success: false,

        });

    }
}

// Get Appointment by Id
exports.getAppointmentById = async (req, res) => {
    try {
        const { appointmentId } = req.query;

        if (!appointmentId) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById(appointmentId)
            .populate("physioId couponId")
            .populate({ path: 'physioId', populate: { path: 'specialization' } });

        const plainObject = appointment?.toObject()

        if (plainObject?.isTreatmentScheduled.isTreatmentCompleted) {
            const PatientInvoice = await invoice.findOne({ appointmentId: plainObject._id, type: "treatment" });
            if (PatientInvoice) {
                plainObject.invoice = PatientInvoice;
            }
        }
        else if (plainObject?.appointmentCompleted) {
            const PatientInvoice = await invoice.findOne({ appointmentId: plainObject._id, type: "appointment" });
            if (PatientInvoice) {
                plainObject.invoice = PatientInvoice;
            }

        }



        if (!appointment) return res.status(400).json({
            message: 'Appointment not found',
            success: false,
            status: 400
        });

        res.status(200).json({
            message: 'Appointment fetched',
            success: true,
            status: 200,
            data: plainObject
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
}


exports.sendNotificationForTreatment = async (req, res) => {
    try {
        const { patientId, physioId, appointmentId } = req.body;
        if (!patientId || !physioId || !appointmentId) {
            return res.status(400).send({
                message: "patientId, physioId and appointmentId are required.",
                status: 400,
                success: false
            });
        }

        const [isPhysio, isPatient, isAppointment] = await Promise.all([
            Physio.findById(physioId),
            Patient.findById(patientId),
            Appointment.findById(appointmentId)
        ]);

        if (!isPhysio) {
            return res.status(404).send({
                message: "Physio not found.",
                status: 404,
                success: false
            });
        }

        if (!isPatient) {
            return res.status(404).send({
                message: "Patient not found.",
                status: 404,
                success: false
            });
        }

        if (!isAppointment) {
            return res.status(404).send({
                message: "Appointment not found.",
                status: 404,
                success: false
            });
        }

        if (isAppointment.isTreatmentRequested) {
            return res.status(400).send({
                message: "Treatment already requested.",
                status: 400,
                success: false
            });
        }

        if (!isPhysio.deviceId) {
            return res.status(400).send({
                message: "Physio does not have a deviceId registered.",
                status: 400,
                success: false
            });
        }

        await Appointment.findOneAndUpdate({
            _id: appointmentId
        }, {
            isTreatmentRequested: true
        })

        const notificationData = {
            physioId: physioId.toString(),
            patientId: patientId.toString(),
            title: 'Treatment Request',
            body: `Patient ${isPatient.fullName} has sent a request for treatment. Please create a treatment plan.`,
            type: 'treatment',
            from: 'patient',
            to: 'physio',
            for: 'physio'
        };

        const result = await sendFCMNotification(isPhysio.deviceId, notificationData);

        await Chat.findOneAndUpdate({
            patientId: isPatient._id,
            physioId: isPhysio._id
        },
            {
                $push: {

                    messages: {
                        message: notificationData.body,
                        sender: 'patient',
                        isRead: false
                    }
                }
            }, {
            new: true
        })

        if (result) {
            return res.status(200).send({
                message: "Notification sent successfully.",
                status: 200,
                success: true
            });
        } else {
            return res.status(502).send({
                message: "Failed to send notification.",
                status: 502,
                success: false
            });
        }

    } catch (error) {
        console.error("Notification error:", error);
        return res.status(500).send({
            message: "Internal server error.",
            error: error.message,
            status: 500,
            success: false
        });
    }
};


exports.addTreatmentMultipleDayPayment = async (req, res) => {

    try {
        const {
            appointmentsId,
            dateIdArray,
            patientId,
            amount,
            isRazorpay,
            coin,
            appointmentAmount,
            couponId
        } = req.body;

        // Validate inputs
        if (!appointmentsId || !dateIdArray || !patientId || !amount || !Array.isArray(dateIdArray)) {

            return res.status(400).json({
                message: "All fields are required and dateIdArray must be an array",
                status: 400,
                success: false
            });
        }

        // Validate dateIdArray elements
        for (const id of dateIdArray) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    message: `Invalid dateId: ${id}`,
                    status: 400,
                    success: false
                });
            }
        }

        // Check if the patient exists
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({
                message: "Patient not found",
                status: 404,
                success: false
            });
        }

        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (!coupon) return res.status(400).json({
                message: 'Coupon not found',
                success: false,
                status: 400
            });
        }

        // Use aggregation to find appointment and treatment dates
        const appointments = await Appointment.aggregate([{
            $match: {
                _id: new mongoose.Types.ObjectId(appointmentsId),
                patientId: new mongoose.Types.ObjectId(patientId)
            }
        },
        {
            $unwind: "$isTreatmentScheduled"
        },
        {
            $unwind: "$isTreatmentScheduled.treatmentDate"
        },
        {
            $match: {
                "isTreatmentScheduled.treatmentDate._id": {
                    $in: dateIdArray.map(id => new mongoose.Types.ObjectId(id))
                }
            }
        },
        {
            $project: {
                "isTreatmentScheduled.amount": 1,
                "isTreatmentScheduled.treatmentDate": 1
            }
        }
        ]);


        if (appointments.length === 0) {
            return res.status(404).json({
                message: "Appointment or treatment dates not found",
                status: 404,
                success: false
            });
        }

        let paymentAmount = parseFloat(amount);

        const treatmentSchedules = appointments.map(app => app.isTreatmentScheduled);

        // Check if the provided amount is sufficient for all scheduled treatments
        // for (let treatmentSchedule of treatmentSchedules) {
        //     if (treatmentSchedule.amount > amount) {

        //         // console.log(treatmentSchedule.amount, amount, "treatmentSchedule.amount > amount");

        //         return res.status(400).json({
        //             message: `Insufficient balance for date ${treatmentSchedule.treatmentDate._id}`,
        //             status: 400,
        //             success: false
        //         });
        //     }
        // }

        if (isRazorpay == false || isRazorpay == "false") {
            // const dateIdArray = dateIdArray; // Ensure this is an array in notes


            // return console.log( paymentAmount, "amount")

            if (!Array.isArray(dateIdArray) || isNaN(paymentAmount)) {
                return res.status(400).json({
                    message: 'Invalid dateIdArray or amount in payment notes',
                    success: false,
                    status: 400
                });
            }

            // Use findById to find the appointment
            const appointment = await Appointment.findById(appointmentsId);

            if (!appointment) {
                return res.status(404).json({
                    message: "Appointment not found",
                    success: false,
                    status: 404
                });
            }

            // Check if treatmentDate exists in the appointment
            if (!appointment.isTreatmentScheduled || !Array.isArray(appointment.isTreatmentScheduled.treatmentDate)) {
                return res.status(400).json({
                    message: "No treatment dates found in appointment",
                    success: false,
                    status: 400
                });
            }

            // Check if each treatment date in the dateIdArray exists
            const treatmentDates = appointment.isTreatmentScheduled.treatmentDate.filter(treatment =>
                dateIdArray.includes(treatment._id.toString()) // Ensure you are matching the correct ID
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

            // Save the updated appointment with the modified treatment dates
            await appointment.save();

            // Update the adminAmount by adding the payment amount
            appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount; // Safely increment adminAmount
            await appointment.save(); // Save the updated appointment

            // Optionally, you can notify the patient here (if required)
            // const patient = await Patient.findById(appointment.patientId);
            // Add logic to send notifications if needed.
            const patient = await Patient.findById(appointment.patientId);
            if (!patient) {
                return res.status(404).json({
                    message: "Patient not found",
                    success: false,
                    status: 404
                });
            }

            if (coin) {
                // const patient = await Patient.findOne({
                //     _id: patient._id,
                // });
                if (patient) {
                    // coin mains
                    patient.wallet = patient.wallet - parseInt(coin)
                    await patient.save();
                }
            }

            // Optionally, send a confirmation or notification (if needed)

            // const physio = await appointment.findById(appointment.physioId);

            if (patient.physioId == appointment.physioId) {

                // physio amount update
                const physio = await Physio.findByIdAndUpdate(appointment.physioId, {
                    $inc: {

                        wallet: coin,
                    }
                }, {
                    new: true
                });

                // treatment amount Add by physio
                // const treatment = new Transaction({
                //     appointmentId: appointment._id,
                //     physioId: appointment.physioId,
                //     amount: paymentAmount,
                //     appointmentAmount,
                // transactionId: payment.id,
                //     physioTransactionType: 0,
                //     paymentMode: 'online',
                //     treatment: true,
                //     paymentStatus: 'completed'
                // })
                // await treatment.save();

                await Transaction.create({
                    physioId: appointment.physioId,
                    patientId: appointment.patientId,
                    appointmentId: appointment._id,
                    amount: paymentAmount,
                    appointmentAmount: appointmentAmount,
                    isTreatment: true,
                    transactionId: `PHONL_${generateRandomCode()}`,
                    physioTransactionType: "credit",
                    paymentStatus: "paid",
                    paymentMode: "online",
                    paidTo: "physio",
                    paidFor: "treatment",
                });

                // treatment amount Add by patient
                // const treatment2 = new Transaction({
                //     appointmentId: appointment._id,
                //     patientId: appointment.patientId,
                //     amount: paymentAmount,
                //     appointmentAmount,
                //     transactionId: payment.id,
                //     patientTransactionType: 1,
                //     paymentMode: 'online',
                //     treatment: true,
                //     paymentStatus: 'completed'
                // })
                // await treatment2.save();

                return res.status(200).json({
                    message: "Treatment payment verified and adminAmount updated successfully",
                    success: true,
                    status: 200,
                    data: appointment // Return the updated appointment
                });
            } else {
                const physio = await Physio.findById(appointment.physioId).populate({
                    path: 'subscriptionId',
                    populate: { path: 'planId' }
                }).lean();

                if (!physio) {
                    return res.status(404).json({
                        message: 'Physio not found',
                        success: false,
                        status: 404
                    });
                }

                const planType = physio.subscriptionId.planId.planType
                const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

                let amounts = parseFloat(appointmentAmount); // total amount
                let PlatformCharges = (amounts * platformChargesPercentage) / 100; // platform charges
                let gst = (PlatformCharges * 18) / 100; //gst charges

                // physio amount update
                await Physio.findByIdAndUpdate(appointment.physioId, {
                    $inc: {
                        // wallet amount plus
                        wallet: coin,
                    }
                }, {
                    new: true
                });

                await Physio.findByIdAndUpdate(
                    physio._id,
                    {
                        $inc: { wallet: (appointmentAmount - (PlatformCharges + gst)) },
                    }
                );

                // treatment amount Add by physio
                // const treatment = new Transaction({
                //     appointmentId: appointment._id,
                //     physioId: appointment.physioId,
                //     appointmentAmount,
                //     amount: paymentAmount,
                //     transactionId: coin ? `PHCOIN_${generateRandomCode()}` : `PHONl_${generateRandomCode()}`,
                //     physioTransactionType: 0,
                //     paymentMode: coin ? "coin" : "online",
                //     treatment: true,
                //     paymentStatus: 'paid',
                //     PlatformCharges: PlatformCharges,
                //     gst: gst,
                //     physioAmount: coin ? 0 : (amount - (PlatformCharges + gst)),
                //     adminAmount: coin ? 0 : PlatformCharges,
                //     coin: coin,
                //     createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                //     updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                // })
                // await treatment.save();

                const transaction = await Transaction.create({
                    orderId: payment.id,
                    physioId: appointment.physioId,
                    patientId: appointment.patientId,
                    appointmentId: appointment._id,
                    couponId: payment.notes.couponId,
                    amount: paymentAmount,
                    appointmentAmount: appointmentAmount,
                    transactionId: `PHONL_${generateRandomCode()}`,
                    physioTransactionType: "credit",
                    paymentStatus: "paid",
                    paymentMode: "online",
                    paidTo: "physio",
                    paidFor: "treatment",
                    isTreatment: true,
                    platformCharges: PlatformCharges,
                    gstAmount: gst,
                    physioPlusAmount: PlatformCharges,
                    physioAmount: (paymentAmount - (PlatformCharges + gst)),
                });

                // // treatment amount Add by patient
                // const treatment2 = new Transaction({
                //     appointmentId: appointment._id,
                //     patientId: appointment.patientId,
                //     appointmentAmount,
                //     amount: amounts,
                //     transactionId: coin ? `PHCOIN_${generateRandomCode()}` : `PHONl_${generateRandomCode()}`,
                //     patientTransactionType: 1,
                //     paymentMode: coin ? "coin" : "online",
                //     treatment: true,
                //     paymentStatus: 'paid',
                //     coin: coin,
                //     createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                //     updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                // })
                // await treatment2.save();

                return res.status(200).json({
                    message: "Treatment payment verified and adminAmount updated successfully",
                    success: true,
                    status: 200,
                    data: appointment // Return the updated appointment
                });
            }
        }
        else {

            // Prepare the payment options for Razorpay
            const paymentOptions = {
                amount: amount * 100, // total amount in the smallest currency unit (paise)
                currency: "INR",
                receipt: "order_rcptid_11",
                payment_capture: '1',
                notes: {
                    appointmentId: appointmentsId,
                    dateIdArray: dateIdArray,
                    amount: parseFloat(amount),
                    coin: coin,
                    couponId: couponId ? couponId : null,
                    appointmentAmount
                }
            };

            // Create the payment order using Razorpay instance
            const razorpay = await instance.orders.create(paymentOptions);

            if (couponId) {
                await Coupon.findByIdAndUpdate(
                    couponId,
                    {
                        $addToSet: {
                            patientId: patientId
                        }
                    },
                    { new: true }
                );
            }

            return res.status(200).json({
                message: "Payment initiated",
                status: 200,
                success: true,
                razorpay
            });
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false,
            error: error
        });
    }
};

// verify treatment multiple day payment
exports.verifyTreatmentMultipleDayPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({
                message: 'orderId is required',
                success: false,
                status: 400
            });
        }

        // Fetch the payment details from the payment provider
        const payment = await instance.orders.fetch(orderId);

        if (payment.status === 'paid') {
            // Extract dateIdArray and amount from payment notes
            const dateIdArray = payment.notes.dateIdArray; // Ensure this is an array in notes
            const paymentAmount = payment.notes.amount;
            const couponId = payment.notes.couponId
            const coin = payment.notes.coin;
            const coinValue = Number(coin) || 0;
            const appointmentAmount = payment.notes.appointmentAmount;
            // return console.log( paymentAmount, "amount")

            if (!Array.isArray(dateIdArray) || isNaN(paymentAmount)) {
                return res.status(400).json({
                    message: 'Invalid dateIdArray or amount in payment notes',
                    success: false,
                    status: 400
                });
            }

            // Use findById to find the appointment
            const appointment = await Appointment.findById(payment.notes.appointmentId);

            if (!appointment) {
                return res.status(404).json({
                    message: "Appointment not found",
                    success: false,
                    status: 404
                });
            }

            // Check if treatmentDate exists in the appointment
            if (!appointment.isTreatmentScheduled || !Array.isArray(appointment.isTreatmentScheduled.treatmentDate)) {
                return res.status(400).json({
                    message: "No treatment dates found in appointment",
                    success: false,
                    status: 400
                });
            }

            // Check if each treatment date in the dateIdArray exists
            const treatmentDates = appointment.isTreatmentScheduled.treatmentDate.filter(treatment =>
                dateIdArray.includes(treatment._id.toString()) // Ensure you are matching the correct ID
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

            // Save the updated appointment with the modified treatment dates
            await appointment.save();

            // Update the adminAmount by adding the payment amount
            appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount; // Safely increment adminAmount
            await appointment.save(); // Save the updated appointment

            // Optionally, you can notify the patient here (if required)
            const patient = await Patient.findById(appointment.patientId);
            // Add logic to send notifications if needed.

            if (!patient) {
                return res.status(404).json({
                    message: "Patient not found",
                    success: false,
                    status: 404
                });
            }

            const paidDates = (appointment?.isTreatmentScheduled?.treatmentDate || []).filter(e =>
                dateIdArray.some(id => e._id.equals(id))
            ).map(e => e.date);

            if (patient.physioId == appointment.physioId) {
                // Update the physio amount
                await Physio.findByIdAndUpdate(appointment.physioId, {
                    $inc: {
                        adminAmount: paymentAmount // Update physio's admin amount by 22% of paymentAmount
                    }
                }, {
                    new: true
                });

                // Log the treatment transaction
                // const transaction = new Transaction({
                //     appointmentId: appointment._id,
                //     physioId: appointment.physioId,
                //     amount: paymentAmount, // Store the amount allocated to the physio
                //     transactionId: payment.id,
                //     physioTransactionType: 0,
                //     paymentMode: 'online',
                //     treatment: true,
                //     paidForDates: paidDates,
                //     couponId: couponId,
                //     paymentStatus: 'paid',
                //     createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                //     updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                // });
                // await transaction.save();

                await Transaction.create({
                    orderId: payment.id,
                    physioId: appointment.physioId,
                    patientId: appointment.patientId,
                    appointmentId: appointment._id,
                    couponId: couponId,
                    amount: paymentAmount,
                    appointmentAmount: paymentAmount,
                    transactionId: `PHONL_${generateRandomCode()}`,
                    physioTransactionType: "credit",
                    paymentStatus: "paid",
                    paymentMode: "online",
                    paidTo: "physio",
                    paidFor: "treatment",
                    paidForDates: paidDates,
                    isTreatment: true
                });

                // // Log the treatment transaction
                // const transaction2 = new Transaction({
                //     patientId: appointment.patientId,
                //     amount: (paymentAmount - coin),
                //     transactionId: payment.id,
                //     patientTransactionType: 1,
                //     paymentMode: 'online',
                //     treatment: true,
                //     paymentStatus: 'paid',
                //     couponId: couponId,
                //     coin: coin,
                //     createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                //     updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                // });
                // await transaction2.save();

                // add amount to physio wallet
                const physio = await Physio.findById(payment.notes.physioId);
                await physio.findByIdAndUpdate(physio._id, { $inc: { wallet: payment.amount / 100 } });

                return res.status(200).json({
                    message: "Treatment payments verified successfully",
                    success: true,
                    status: 200,
                    data: appointment // Return the updated appointment
                });
            } else {
                let physio = await Physio.findById(appointment.physioId).populate({
                    path: 'subscriptionId',
                    populate: { path: 'planId' }
                }).lean();

                if (!physio) {
                    return res.status(404).json({
                        message: 'Physio not found',
                        success: false,
                        status: 404
                    });
                }

                const planType = physio.subscriptionId.planId.planType
                const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

                let amount = parseInt(appointmentAmount); // total amount
                let PlatformCharges = (amount * platformChargesPercentage) / 100; // platform charges
                let gst = (PlatformCharges * 18) / 100; //gst charges

                // Update the physio amount
                physio = await Physio.findByIdAndUpdate(appointment.physioId, {
                    $inc: {
                        adminAmount: ((amount - (PlatformCharges + gst) + coinValue)) // Update physio's admin amount by 22% of paymentAmount
                    }
                }, {
                    new: true
                });


                await Physio.findByIdAndUpdate(
                    physio._id,
                    {
                        $inc: { wallet: (appointmentAmount - (PlatformCharges + gst)) },
                    }
                );

                // // Log the treatment transaction
                // const treatment = new Transaction({
                //     appointmentId: appointment._id,
                //     physioId: appointment.physioId,
                //     appointmentAmount,
                //     amount: paymentAmount + coinValue,
                //     orderId: payment.id,
                //     transactionId: coin ? `PHCOIN_${generateRandomCode()}` : `PHONl_${generateRandomCode()}`,
                //     physioTransactionType: 0,
                //     paymentMode: couponId ? "online/voucher" : "online",
                //     treatment: true,
                //     paymentStatus: 'paid',
                //     PlatformCharges: PlatformCharges,
                //     gst: gst,
                //     couponId: couponId,
                //     physioAmount: (amount - (PlatformCharges + gst)),
                //     adminAmount: PlatformCharges,
                //     coin: coin,
                //     createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                //     updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                // })
                // await treatment.save();

                const transaction = await Transaction.create({
                    physioId: appointment.physioId,
                    patientId: appointment.patientId,
                    appointmentId: appointment._id,
                    couponId: couponId,
                    amount: paymentAmount,
                    appointmentAmount: appointmentAmount,
                    transactionId: `PHONL_${generateRandomCode()}`,
                    physioTransactionType: "credit",
                    paymentStatus: "paid",
                    paymentMode: "online",
                    paidTo: "physio",
                    paidFor: "treatment",
                    paidForDates: paidDates,
                    isTreatment: true,
                    platformCharges: PlatformCharges,
                    gstAmount: gst,
                    physioPlusAmount: PlatformCharges,
                    physioAmount: (paymentAmount - (PlatformCharges + gst)),
                });

                // // treatment amount Add by patient
                // const treatment2 = new Transaction({
                //     appointmentId: appointment._id,
                //     patientId: appointment.patientId,
                //     appointmentAmount,
                //     amount: paymentAmount,
                //     orderId: payment.id,
                //     transactionId: coin ? `PHCOIN_${generateRandomCode()}` : `PHONl_${generateRandomCode()}`,
                //     patientTransactionType: 1,
                //     paymentMode: couponId ? "online/voucher" : "online",
                //     treatment: true,
                //     paidForDates: paidDates,
                //     couponId: couponId,
                //     paymentStatus: 'paid',
                //     coin: coin,
                //     createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                //     updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                // })
                // await treatment2.save();

                const cacheKey = CashBackCacheKey()
                let patientCount = await redisClient.get(cacheKey);
                patientCount = parseInt(patientCount) || 0;

                let CashBackData = null;

                let data = {
                    physioId: patient._id.toString(),
                    title: "Payment Confirmed",
                    body: 'Your payment is successful, and you have received a scratch card.',
                    type: "treatment",
                    from: "admin",
                    to: "patient",
                    for: "patient",
                    name: patient.fullName.toString(),
                }

                const CheckTransaction = await Transaction.find({ appointmentId: appointment._id, paidFor: 'treatment' }).countDocuments()

                if (appointment.isTreatmentScheduled.treatmentDate.length > 0) {
                    const allPaid = appointment.isTreatmentScheduled.treatmentDate.every((obj) => obj.isPaid === true);

                    if (allPaid && CheckTransaction === 1) {
                        patientCount += 1;

                        const result = await sendFCMNotification(patient.deviceId, data);
                        if (!result.success) {
                            console.log("Error sending notification to physio", result);
                        }

                        let obj = {
                            userId: appointment.patientId || null,
                            appointmentId: appointment._id || null,
                            transactionId: transaction._id || null,
                        }
                        if (patientCount === 15) {
                            obj.rewardPercentage = "70%"
                            obj.rewardAmount = (Number(paymentAmount || 0) * 70) / 100

                            CashBackData = await GiveCashBack(obj);
                            patientCount = 0; // reset after 15th
                        } else {
                            obj.rewardPercentage = "5%"
                            obj.rewardAmount = (Number(paymentAmount || 0) * 5) / 100
                            CashBackData = await GiveCashBack(obj);
                        }

                        await redisClient.set(cacheKey, patientCount);
                    }
                }

                // Send Payment Confirmed Notification to Physio
                data = {
                    physioId: physio._id.toString(),
                    title: "Payment Confirmed",
                    body: `Your treatment payment has been confirmed with ${patient?.fullName ?? "the patient"}`,
                    type: "treatment",
                    from: "admin",
                    to: "physio",
                    for: "physio",
                    name: physio.fullName.toString(),
                }

                const result = await sendFCMNotification(physio.deviceId, data);
                if (!result.success) {
                    console.log("Error sending notification to physio", result);
                }

                return res.status(200).json({
                    message: "Treatment payments verified successfully",
                    success: true,
                    status: 200,
                    data: appointment,
                });
            }

        } else {
            return res.status(400).json({
                message: "Payment not successful",
                success: false,
                status: 400
            });
        }

    } catch (error) {
        console.error("Error in payment verification:", error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};

exports.transactionsByAppointmentId = async (req, res) => {

    try {
        const { appointmentId } = req.query

        // console.log("sdf" + req.query);

        if (!appointmentId) {
            return res.status(400).json({
                message: 'appointmentId is required',
                status: 400
            })
        }

        const transaction = await Transaction.find({ appointmentId });

        const modifiedTransactions = [];

        for (const doc of transaction) {
            const invoiceDoc = await invoice.findOne({ transactionId: doc._id });
            const plainObject = doc.toObject();

            if (invoiceDoc) {
                plainObject.invoice = invoiceDoc;
            }

            modifiedTransactions.push(plainObject);
        }

        return res.status(200).json({
            message: 'success',
            data: modifiedTransactions
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: 'Internal server Error',
            status: 500,
            error: error.message
        })


    }
}

exports.updateCashBack = async (req, res) => {
    try {
        const { cashBackId, userUpiId } = req.query

        if (!cashBackId || !userUpiId) {
            return res.status(404).json({
                message: "CashBackId or userUpiId  is required",
                status: 404,
                success: false,
                q: req.query
            });
        }

        const isCashBack = await CashBack.findByIdAndUpdate(cashBackId, {
            $set: {
                userUpiId: userUpiId,
                status: 'process'
            }
        }, {
            new: true
        })

        if (isCashBack) {
            return res.status(200).json({
                message: "success",
                status: 200,
                success: true,
                isCashBack: isCashBack,
            });
        }
        else {
            return res.status(404).json({
                message: "not found",
                status: 404,
                success: true,
                isCashBack: isCashBack,
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong, please try again later" + error,
            status: 500,
            success: false
        });
    }
}

exports.getCashBack = async (req, res) => {
    const { appointmentId } = req.query

    if (!appointmentId) {
        return res.status(404).json({
            message: "AppointmentId is required",
            status: 404,
            success: false
        });
    }

    const cashBack = await CashBack.findOne({ appointmentId })

    if (cashBack) {
        return res.status(200).json({
            message: "success",
            status: 200,
            success: true,
            data: cashBack,
        });
    }
    else {
        return res.status(201).json({
            message: "not found",
            status: 201,
            success: false,
            data: cashBack
        });
    }
}

// exports.appointmentPdf = async (req, res) => {
//     try {
//         const { appointmentId } = req.query;

//         if (!appointmentId) return res.status(400).json({
//             message: 'AppointmentId is required',
//             success: false,
//             status: 400
//         });

//         const appointment = await Appointment.findById(appointmentId).populate("patientId physioId");
//         if (!appointment) return res.status(400).json({
//             message: 'Appointment not found',
//             success: false,
//             status: 400
//         });

//         // Generate PDF
//         const pdf = new PDFDocument();
//         let buffers = [];
//         pdf.on('data', buffers.push.bind(buffers));
//         pdf.on('end', () => {
//             let pdfData = Buffer.concat(buffers);
//             res.writeHead(200, {
//                 'Content-Type': 'application/pdf',
//                 'Content-Length': pdfData.length
//             })
//             res.end(pdfData);
//         });

//         pdf.text(`Appointment Id: ${appointment._id}`);
//         pdf.text(`Patient Name: ${appointment.patientName}`);
//         pdf.text(`Physio Name: ${appointment.physioId.name}`);
//         pdf.text(`Date: ${appointment.date}`);
//         pdf.text(`Time: ${appointment.time}`);
//         pdf.text(`Amount: ${appointment.amount}`);
//         pdf.text(`Status: ${appointment.status}`);
//         // orderId
//         pdf.text(`Order Id: ${appointment.orderId}`);
//         pdf.text(`Payment Status: ${appointment.paymentStatus}`);
//         pdf.text(`Appointment Type: ${appointment.serviceType}`);
//         pdf.end();

//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({
//             message: 'Server Error',
//             success: false,
//             status: 500
//         });
//     }
// }



