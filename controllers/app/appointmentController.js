const Appointment = require('../../models/appointment');
const Patient = require('../../models/patient');
const Physio = require('../../models/physio');
const Invoice = require('../../models/invoice');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const Coupon = require('../../models/coupon');
const Transaction = require('../../models/transaction');
const Subscription = require('../../models/subscription');
const generateRandomCode = require('../../utility/generateRandomCode');
const PhysioHelper = require('../../utility/physioHelper');
const { sendFCMNotification } = require('../../services/fcmService');
const sendAppointmentEmail = require('../../services/sendEmail');
const { GiveCashBack, CashBackCacheKey } = require('../../utility/cashBackUtility');
const { redisClient } = require('../../utility/redisClient');
const CashBack = require('../../models/cashBack');
const moment = require('moment')

var instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// generate random code

const generateRandomOTP = () => {
    return Math.floor(1000 + Math.random() * 9000); // Generates a number between 1000 and 9999
};



exports.createAppointment = async (req, res) => {

    console.log(req.body);

    try {
        const {
            patientId,
            physioId,
            date,
            patientName,
            age,
            gender,
            phone,
            painNotes,
            amount,
            couponId,
            appointmentAddress
        } = req.body;

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

        if (couponId) {
            const coupon = await Coupon.findById({
                _id: couponId
            });
            if (!coupon) return res.status(400).json({
                message: 'Coupon not found',
                success: false,
                status: 400
            });
        }
        const appointment = await new Appointment({
            patientId,
            physioId,
            status: 0,
            date,
            paymentMode: 'cash',
            patientName,
            age,
            gender,
            phone: phone,
            painNotes,
            amount,
            otp: Number(generateRandomOTP()),
            isAppointmentRequest: true,
            bookingSource: "mobile",
            couponId: couponId ? couponId : null,
            createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
            updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
        });
        await appointment.save();

        const platformCharges = (amount * 22) / 100;
        const gst = (platformCharges * 18) / 100;
        await Physio.findByIdAndUpdate(physio._id, {
            $inc: { wallet: (amount - (platformCharges + gst)) }
        });
        console.log(platformCharges);
        console.log(gst);

        const transaction = await Transaction.create({
            physioId: appointment.physioId,
            patientId: appointment.patientId,
            appointmentId: appointment._id,
            couponId: couponId || null,
            amount: amount,
            transactionId: `PHONL_${generateRandomCode()}`,
            patientTransactionType: "debit",
            physioTransactionType: "credit",
            paymentStatus: "paid",
            paymentMode: "cash",
            paidTo: "physio",
            paidFor: "appointment",
            platformCharges: platformCharges,
            gstAmount: gst,
            physioPlusAmount: platformCharges,
            physioAmount: (amount - (platformCharges + gst)),
        });


        //appointment add transactionTd
        appointment.transactionId = transaction._id;
        await appointment.save()


        if (patient) {
            // Update the patient document with the new appointment address
            if (patient.appointmentAddress !== appointmentAddress?.toString()) {
                patient.appointmentAddress = appointmentAddress;
            }

            // Check if address already exists in patientAddresses
            let isAddressExists = patient.patientAddresses.some((entry) => {
                return entry.appointmentAddress === appointmentAddress?.toString();
            });

            // If not, push the new address
            if (!isAddressExists) {
                patient.patientAddresses.push({
                    appointmentAddress: appointmentAddress?.toString()
                });
            }

            await patient.save();
        }

        if (physio && patient) {
            const serviceType = ["Home", "Clinic", "Online"][appointment.serviceType]

            let data = {
                title: "Upcoming consultation!",
                body: `You have upcoming home consultation`,
                serviceType: serviceType,
                physioId: physio._id.toString(),
                name: patient.fullName,
                time: appointment.time,
                date: appointment.date,
                type: 'appointment',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            // Send Notification to Physio
            let result = await sendFCMNotification(physio.deviceId, data)

            // if (!result.success) {
            //     console.log("Error sending notification to physio", result);
            // }

            // Send Notification to Patient
            data = {}
            data.title = "Upcoming consultation!",
                data.body = `You have upcoming home consultation`,
                data.name = physio.fullName
            data.type = 'appointment'
            data.from = 'admin'
            data.to = 'patient'
            data.for = 'patient'
            data.physioId = null
            data.patientId = patient._id.toString(),
                result = await sendFCMNotification(patient.deviceId, data)

            // if (!result.success) {
            //     console.log("Error sending notification to patient", result);
            // }
        }


        res.status(200).json({
            message: 'Appointment created',
            success: true,
            status: 200,
            data: appointment
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
};

// Appointment with razorpay payment gatewayexports.createAppointmentRazorpay = async (req, res) => {
// Appointment with razorpay payment gatewayexports.createAppointmentRazorpay = async (req, res) => {
exports.createAppointmentRazorpay = async (req, res) => {

    // base url for quick testing - http://localhost:8000/api/appointment/addAppointment
    try {
        const {
            patientId,
            physioId,
            date,
            patientName,
            age,
            gender,
            phone,
            painNotes,
            amount,
            couponId,
            isRazorpay,
            appointmentAmount,
            appointmentAddress
        } = req.body;

        // return console.log(req.body, "Appointment with razorpay payment gateway");

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
        });
        if (checkAppointment) return res.status(400).json({
            message: 'Appointment already booked',
            success: false,
            status: 400
        });


        if (patient && appointmentAddress) {
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

            await patient.save();
        }

        if (isRazorpay == false || isRazorpay == "false") {
            const appointment = new Appointment({
                patientId,
                isAppointmentRequest: true,
                physioId,
                date,
                patientName,
                age,
                gender,
                paymentMode: 'online',
                phone: phone,
                painNotes,
                amount,
                otp: Number(generateRandomOTP()),
                paymentStatus: 1,
                couponId: couponId ? couponId : null,
                bookingSource: "mobile",
            })

            try {
                await appointment.save(); // Save the appointment

                // Send Notification to physio and patient
                if (physio && patient) {
                    const serviceType = ["Home", "Clinic", "Online"][appointment.serviceType];

                    // Send notification to physio
                    const physioData = {
                        physioId: physio._id.toString(),
                        patientId: patient._id.toString(),
                        name: patient.fullName,
                        title: "Upcoming Consultation!",
                        body: `You have upcoming ${serviceType} consultation`,
                        type: 'appointment',
                        from: 'admin',
                        to: 'physio',
                        for: 'physio',
                        time: appointment.time,
                        date: appointment.date
                    }

                    // Send notification to patient
                    const patientData = {
                        physioId: physio._id.toString(),
                        patientId: patient._id.toString(),
                        name: physio.fullName,
                        title: "Upcoming Consultation!",
                        body: `You have upcoming ${serviceType} consultation`,
                        type: 'appointment',
                        from: 'admin',
                        to: 'patient',
                        for: 'patient',
                        time: appointment.time,
                        date: appointment.date
                    }

                    const [physioResult, patientResult] = await Promise.all([
                        sendFCMNotification(physio.deviceId, physioData),
                        sendFCMNotification(patient.deviceId, patientData)
                    ]);

                    if (!physioResult.success) {
                        console.log("Error sending notification to physio", physioResult);
                    }

                    if (!patientResult.success) {
                        console.log("Error sending notification to patient", patientResult);
                    }
                }

                console.log('Appointment and patient updated successfully');
            } catch (error) {
                console.error('Error saving appointment or updating patient:', error);
            }

            // Subscription  patientCount
            const subscription = await Subscription.findById(physio.subscriptionId).populate("planId");

            const planType = subscription.planId.planType
            let transaction2

            // Create the transaction for patient
            if (patient.physioId == appointment.physioId) {
                transaction2 = new Transaction({
                    appointmentId: appointment._id,
                    patientId: appointment.patientId,
                    appointmentAmount: appointmentAmount,
                    amount: (appointment.amount - coin),
                    planType: planType,
                    transactionId: coin ? `PHCOI_${generateRandomCode()}` : `PHONl_${generateRandomCode()}`,
                    patientTransactionType: "debit",
                    paymentMode: 'online',
                    treatment: false,
                    paymentStatus: 'paid'
                })
                await transaction2.save();

                // Create the transaction for physio
                const transaction = new Transaction({
                    appointmentId: appointment._id,
                    physioId: appointment.physioId,
                    appointmentAmount: appointmentAmount,
                    planType: planType,
                    amount: appointment.amount,
                    transactionId: coin ? `PHCOI_${generateRandomCode()}` : `PHONl_${generateRandomCode()}`,
                    physioTransactionType: "credit",
                    paymentMode: 'online',
                    treatment: false,
                    paymentStatus: 'paid',
                });
                await transaction.save();

                // add amount to physio wallet
                const physio = await Physio.findById(appointment.physioId);
                await physio.findByIdAndUpdate(physio._id, { $inc: { wallet: coin } });

                // appointment
                appointment.transactionId = transaction2._id;
                await appointment.save();

                return res.status(200).json({
                    message: 'Appointment created',
                    success: true,
                    status: 200,
                    data: appointment
                });
            }
            else {
                const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

                let PlatformCharges = (appointmentAmount * platformChargesPercentage) / 100;
                let gst = (PlatformCharges * 18) / 100;

                await Physio.findByIdAndUpdate(
                    physio._id,
                    {
                        $inc: { wallet: (appointmentAmount - (PlatformCharges + gst)) },
                    }
                );

                const transaction = new Transaction({
                    appointmentId: appointment._id,
                    patientId: appointment.patientId,
                    physioId: appointment.physioId,
                    couponId: appointment.couponId,
                    amount: amount,
                    appointmentAmount,
                    transactionId: `PHONL_${generateRandomCode()}`,
                    physioTransactionType: "debit",
                    paymentStatus: "paid",
                    paymentMode: "online",
                    paidTo: "physio",
                    paidFor: "appointment",
                    platformCharges: PlatformCharges,
                    gstAmount: gst,
                    physioPlusAmount: PlatformCharges,
                    physioAmount: (amount - (PlatformCharges + gst)),
                });
                await transaction.save();
                // Create the transaction for patient
                // transaction2 = new Transaction({
                //     appointmentId: appointment._id,
                //     patientId: appointment.patientId,
                //     appointmentAmount,
                //     amount: appointment.amount,
                //     planType: planType,
                //     transactionId: coin ? `PHCOI_${generateRandomCode()}` : `PHONl_${generateRandomCode()}`,
                //     patientTransactionType: "debit",
                //     paymentMode: 'online',
                //     treatment: false,
                //     paymentStatus: 'paid'
                // });
                // await transaction2.save();

                appointment.transactionId = transaction._id;
                await appointment.save();

                return res.status(200).json({
                    message: 'Appointment created',
                    success: true,
                    status: 200,
                    data: appointment
                });
            }
        }
        var options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                patientId,
                physioId,
                date,
                patientName,
                age,
                gender,
                phone: phone,
                painNotes,
                amount,
                couponId: couponId ? couponId : null,
                appointmentAmount,
                appointmentAddress
            }
        };

        const data = await instance.orders.create(options);

        // if couponId is given then update 
        await Coupon.findByIdAndUpdate(
            couponId,
            {
                $inc: { usageCount: 1 },
                ...(couponId === '67fcdc2d59a910171e3d4541' && {
                    $addToSet: { patientId: patientId }
                })
            },
            { new: true }
        );

        return res.status(200).json({
            message: 'Appointment created',
            success: true,
            status: 200,
            data: data
        });

    } catch (error) {
        console.error("Error in createAppointmentRazorpay:", error);
        res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500,
            error: error.message
        });
    }
}



// Appointment with razorpay payment gateway
exports.verifyRazorpayPayment = async (req, res) => {
    try {
        const { orderId, appointmentAddress } = req.body;

        if (!orderId) {
            return res.status(400).json({
                message: 'orderId is required',
                success: false,
                status: 400
            });
        }

        // Fetch the payment details
        const payment = await instance.orders.fetch(orderId);
        if (payment.status !== 'paid') {
            return res.status(400).json({
                message: 'Payment not successful',
                success: false,
                status: 400
            });
        }

        const physio = await Physio.findById(payment.notes.physioId);
        const patient = await Patient.findById(payment.notes.patientId);
        const couponId = payment.notes.couponId || null;
        const appointmentAmount = payment.notes.appointmentAmount;
        const appointmentAddres = appointmentAddress || payment.notes.appointmentAddress

        // Create appointment

        const appointment = new Appointment({
            patientId: payment.notes.patientId,
            physioId: physio._id,
            status: 0,
            isAppointmentRequest: true,
            date: payment.notes.date,
            time: payment.notes.time,
            patientName: payment.notes.patientName,
            age: payment.notes.age,
            gender: payment.notes.gender,
            phone: payment.notes.phone,
            otp: Number(generateRandomOTP()),
            painNotes: payment.notes.painNotes,
            amount: appointmentAmount,
            timeInString: payment.notes.timeInString,
            orderId: payment.id,
            paymentMode: 'online',
            paymentStatus: 1,
            bookingSource: "mobile",
            couponId,
            adminAmount: payment.notes.amount,
        });

        try {
            await appointment.save(); // Save the appointment

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

                await patient.save();
            }

            console.log('Appointment and patient updated successfully');
        } catch (error) {
            console.error('Error saving appointment or updating patient:', error);
        }
        // const subscription = await Subscription.findById(physio.subscriptionId).populate("planId");
        // const planType = subscription?.planId?.planType || 0; // fallback
        // // Platform charges case
        // const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);
        // const amount = payment.amount / 100;
        const platformCharges = (appointmentAmount * 22) / 100;
        const gst = (platformCharges * 18) / 100;

        await Physio.findByIdAndUpdate(physio._id, {
            $inc: { wallet: (appointmentAmount - (platformCharges + gst)) }
        });

        const transaction = await Transaction.create({
            orderId: payment.id,
            physioId: physio._id,
            patientId: patient._id,
            appointmentId: appointment._id,
            couponId: payment.notes.couponId,
            amount: payment.amount / 100,
            appointmentAmount: appointmentAmount,
            transactionId: `PHONL_${generateRandomCode()}`,
            patientTransactionType: "debit",
            physioTransactionType: "credit",
            paymentStatus: "paid",
            paymentMode: "online",
            paidTo: "physio",
            paidFor: "appointment",
            platformCharges: platformCharges,
            gstAmount: gst,
            physioPlusAmount: platformCharges,
            physioAmount: (payment.amount - (platformCharges + gst)),
        });
        appointment.transactionId = transaction._id;
        await appointment.save();

        // Send Notification to physio and patient
        if (physio && patient) {
            // Send notification to physio
            const physioData = {
                physioId: physio._id.toString(),
                patientId: patient._id.toString(),
                name: patient.fullName,
                title: "Upcoming Consultation!",
                body: `You have upcoming home consultation`,
                type: 'appointment',
                from: 'admin',
                to: 'physio',
                for: 'physio',
                time: appointment.time,
                date: appointment.date
            }

            // Send notification to patient
            const patientData = {
                physioId: physio._id.toString(),
                patientId: patient._id.toString(),
                name: physio.fullName,
                title: "Upcoming Consultation!",
                body: `You have upcoming home consultation`,
                type: 'appointment',
                from: 'admin',
                to: 'patient',
                for: 'patient',
                time: appointment.time,
                date: appointment.date
            }

            const [physioResult, patientResult] = await Promise.all([
                sendFCMNotification(physio.deviceId, physioData),
                sendFCMNotification(patient.deviceId, patientData)
            ]);

            // if (!physioResult.success) {
            //     console.log("Error sending notification to physio", physioResult);
            // }

            // if (!patientResult.success) {
            //     console.log("Error sending notification to patient", patientResult);
            // }
        }
        res.status(200).json({
            message: 'Appointment created',
            success: true,
            status: 200,
            data: appointment
        });


        // Send Email to Admin
        const emailData = {
            patientName: patient.fullName,
            physioName: physio.fullName,
            amount: appointment.amount,
            physioPhone: physio.phone,
            patientPhone: patient.phone,
            date: appointment.date,
            time: appointment.time,
            timeInString: appointment.timeInString
        };
        sendAppointmentEmail({ data: emailData }).catch(e => console.error("Error sending email:", e));

        // Unapprove physio if appointment count is >= 4 and plan type is free

    } catch (error) {
        console.error(error);
        return res.status(500).json({
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
            date
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
        let physio = await Physio.findById(physioId);
        // return console.log(physio);
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });

        // get date from query
        let startDay = moment(date, "YYYY-MM-DDTHH:mm:ss.SSSSSS").startOf('day').format("YYYY-MM-DDTHH:mm:ss.SSSSSS");
        let endDay = moment(date, "YYYY-MM-DDTHH:mm:ss.SSSSSS").endOf('day').format("YYYY-MM-DDTHH:mm:ss.SSSSSS");
        // console.log(endDay);
        const appointments = await Appointment.find(
            // data fatcching from database by physioId and date of ondate
            {
                physioId: physio._id,
                date: {
                    $gte: startDay,
                    $lt: endDay
                }
            }
        ).populate('physioId patientId')
            .populate({
                path: 'physioId',
                populate: {
                    path: 'specialization',
                    model: 'Specialization'
                }
            });

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


// Add Treatment  
exports.addTreatment = async (req, res) => {
    try {
        const {
            appointmentId,
            physioId,
            patientId,
            dates,
            timing,
            mode,
            feePerDay,
            notes,
            status,
            paidPayments
        } = req.body;

        if (!appointmentId) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });
        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });
        if (!patientId) return res.status(400).json({
            message: 'PatientId is required',
            success: false,
            status: 400
        });
        if (!dates) return res.status(400).json({
            message: 'Dates is required',
            success: false,
            status: 400
        });
        if (!timing) return res.status(400).json({
            message: 'Timing is required',
            success: false,
            status: 400
        });
        if (!mode) return res.status(400).json({
            message: 'Mode is required',
            success: false,
            status: 400
        });
        if (!feePerDay) return res.status(400).json({
            message: 'Fee Per Day is required',
            success: false,
            status: 400
        });
        if (!notes) return res.status(400).json({
            message: 'Notes is required',
            success: false,
            status: 400
        });
        if (!status) return res.status(400).json({
            message: 'Status is required',
            success: false,
            status: 400
        });
        if (!paidPayments) return res.status(400).json({
            message: 'Paid Payments is required',
            success: false,
            status: 400
        });

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(400).json({
            message: 'Appointment not found',
            success: false,
            status: 400
        });

        const physio = await Physio.findById(physioId);
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });

        const patient = await Patient.findById(patientId);
        if (!patient) return res.status(400).json({
            message: 'Patient not found',
            success: false,
            status: 400
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Server Error',
            success: false,
            status: 500
        });
    }
};

// Get all appointments of a patient by patientId
exports.getPatientAppointments = async (req, res) => {
    try {
        const {
            patientId,
            appointmentCompleted,
            appointmentStatus,
            isTreatmentCompleted
        } = req.query;

        // Validation: Check if patientId exists and is valid
        if (!patientId || ['undefined', 'null', ''].includes(patientId) || !mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({
                message: 'Invalid or missing patientId',
                success: false,
                status: 400
            });
        }

        // Check if patient exists
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(400).json({
                message: 'Patient not found',
                success: false,
                status: 400
            });
        }

        // Build query
        let query = {
            patientId: patientId,
            ...(appointmentCompleted !== undefined && { appointmentCompleted }),
            ...(appointmentStatus !== undefined && { appointmentStatus }),
            ...(isTreatmentCompleted !== undefined && { "isTreatmentScheduled.isTreatmentCompleted": isTreatmentCompleted })
        };

        // Fetch appointments with populated fields
        const appointments = await Appointment.find(query)
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
            .populate('patientId');

        // Convert to plain JS objects
        let plainAppointments = JSON.parse(JSON.stringify(appointments));

        // Append cashback info
        for (const apt of plainAppointments) {
            const isCashBack = await CashBack.findOne({
                appointmentId: new mongoose.Types.ObjectId(apt._id)
            });

            if (isCashBack) {
                if (!apt.isTreatmentScheduled || typeof apt.isTreatmentScheduled !== 'object') {
                    apt.isTreatmentScheduled = {};
                }

                // Add a clean cashback flag or full cashback doc
                apt.isTreatmentScheduled.isCashBack = isCashBack; // or isCashBack if full doc needed
            }
        }

        return res.status(200).json({
            message: 'Appointments fetched by patientId',
            success: true,
            status: 200,
            data: plainAppointments
        });

    } catch (error) {
        console.error('Error in getPatientAppointments:', error);
        res.status(500).json({
            message: 'Something went wrong. Please try again.',
            success: false,
            status: 500
        });
    }
};

// Get all appointments of a physio by physioId
exports.getPhysioAppointments = async (req, res) => {
    try {
        const {
            physioId,
            serviceType,
            appointmentCompleted
        } = req.query;

        console.log(req.query, "PhysioId, serviceType, appointmentStatus");

        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });

        if (!serviceType) return res.status(400).json({
            message: 'ServiceType is required',
            success: false,
            status: 400
        });

        // if (!appointmentStatus) return res.status(400).json({
        //     message: 'AppointmentStatus is required',
        //     success: false,
        //     status: 400
        // });
        // console.log(physioId, serviceType, appointmentStatus, "PhysioId, serviceType, appointmentStatus");
        const physio = await Physio.findById(physioId);


        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });



        const appointments = await Appointment.find({
            $and: [{
                physioId: physioId
            },
            {
                serviceType: serviceType
            },
            {
                appointmentCompleted: appointmentCompleted
            }
            ]
        })
            .populate('patientId')
        return res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: appointments
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Semething went wrong Please try again',
            success: false,
            status: 500
        });
    }

}

// Appointment Complete by physio
exports.completeAppointment = async (req, res) => {
    try {
        const {
            appointmentId,
            appointmentStatus,
            prescriptionNotes
        } = req.body;

        if (!appointmentId) return res.status(400).json({
            message: 'AppointmentId is required',
            success: false,
            status: 400
        });

        if (!appointmentStatus) return res.status(400).json({
            message: 'appointmentStatus is required',
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

        let updateAppointment = await Appointment.findByIdAndUpdate({
            _id: appointmentId
        }, {
            prescriptionNotes: prescriptionNotes ? prescriptionNotes : null,
            appointmentStatus: Number(appointmentStatus)
        }, {
            new: true
        })

        // 

        return res.status(200).json({
            message: 'Appointment Completed',
            success: true,
            status: 200,
            data: updateAppointment
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Semething went wrong Please try again',
            success: false,
            status: 500
        });
    }

};

// Get all appointments completed by physio
exports.getAppointmentsStatus = async (req, res) => {
    try {
        const {
            physioId,
            appointmentCompleted
        } = req.query;

        if (!physioId) return res.status(400).json({
            message: 'PhysioId is required',
            success: false,
            status: 400
        });

        const physio = await Physio.findById({
            _id: physioId
        });
        if (!physio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });

        console.log(appointmentCompleted, "Status");

        const appointments = await Appointment.find({
            $and: [{
                physioId: physioId
            },
            {
                appointmentCompleted: appointmentCompleted
            }
            ]
        }).populate('physioId patientId').populate({
            path: 'physioId',
            populate: {
                path: 'specialization',
                model: 'Specialization'
            }
        });
        return res.status(200).json({
            message: 'Appointments fetched',
            success: true,
            status: 200,
            data: appointments
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Semething went wrong Please try again',
            success: false,
            status: 500
        });
    }
};


exports.treatmentSchedule = async (req, res) => {
    try {
        const {
            physioId,
            appointmentId,
            date,
            startTime,
            endTime,
            treatmentAmount,
            prescriptionNotes,
            treatmentServiceType
        } = req.body;

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

        if (!appointmentId) {
            return res.status(400).send({
                message: "AppointmentId is required",
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

        if (!treatmentServiceType) {
            return res.status(400).send({
                message: "Treatment service type is required",
                status: 400,
                success: false
            });
        }


        let dateArray;

        // Check if date is a string or array
        if (typeof date === 'string') {
            dateArray = date.split(",");
        } else if (Array.isArray(date)) {
            dateArray = date; // it's already an array
        } else {
            return res.status(400).send({
                message: "Invalid date format",
                status: 400,
                success: false
            });
        }

        const appointments = await Appointment.findById({
            _id: appointmentId,
            physioId
        })

        console.log(appointments, "Appointments");


        if (!appointments) {
            return res.status(404).send({
                message: "Appointment not found...",
                status: 404,
                success: false
            });
        }

        const appointment = await Appointment.findOneAndUpdate({
            _id: appointmentId
        }, {
            $push: {
                isTreatmentScheduled: {
                    treatmentDate: dateArray.map(d => ({
                        date: d
                    })),
                    startTime: startTime,
                    endTime: endTime,
                    amount: treatmentAmount,
                    prescriptionNotes: prescriptionNotes,
                    treatmentServiceType
                },

            },
            appointmentStatus: 1
        }, {
            new: true
        } // return the updated document
        );

        return res.send({
            message: "Treatment added successfully",
            status: 200,
            success: true,
            appointment: appointment
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }

};

exports.addTreatmentSingleDayPayment = async (req, res) => {
    console.log('Single' + JSON.stringify(req.body));
    try {
        const {
            appointmentsId,
            dateId,
            patientId,
            amount,
            isRazorpay,
            coin,
            appointmentAmount,
            couponId
        } = req.body;
        // return console.log(req.body, "req.body");

        if (!appointmentsId || !dateId || !patientId || !amount) {
            return res.status(400).json({
                message: "All fields are required",
                status: 400,
                success: false
            });
        }

        // if check dateId valid objectid
        if (!mongoose.Types.ObjectId.isValid(dateId)) {
            return res.status(400).json({
                message: "Invalid dateId",
                status: 400,
                success: false
            });
        }

        let paymentAmount = parseFloat(amount);

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

        // Use aggregation to find appointment and treatment date
        const appointment = await Appointment.aggregate([{
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
                "isTreatmentScheduled.treatmentDate._id": new mongoose.Types.ObjectId(dateId)
            }
        },
        {
            $project: {
                "isTreatmentScheduled.amount": 1,
                "isTreatmentScheduled.treatmentDate": 1
            }
        }
        ]);

        if (appointment.length === 0) {
            return res.status(404).json({
                message: "Appointment or treatment date not found",
                status: 404,
                success: false
            });
        }

        const treatmentSchedule = appointment[0].isTreatmentScheduled;

        // Check if the provided amount is less than the scheduled amount
        if (treatmentSchedule.amount === amount) {
            return res.status(400).json({
                message: "Insufficient balance",
                status: 400,
                success: false
            });
        }

        if (isRazorpay == false || isRazorpay == "false") {
            const appointment = await Appointment.findById(appointmentsId).populate('patientId');

            if (!appointment) {
                return res.status(404).json({
                    message: "Appointment not found",
                    success: false,
                    status: 404
                });
            }

            // Check if `isTreatmentScheduled` and `treatmentDate` exist
            if (!appointment.isTreatmentScheduled || !appointment.isTreatmentScheduled.treatmentDate) {
                return res.status(400).json({
                    message: "No treatment date found for this appointment",
                    success: false,
                    status: 400
                });
            }

            // Find the treatment date corresponding to the dateId
            const treatmentDate = appointment.isTreatmentScheduled.treatmentDate.find(date =>
                date._id.toString() === dateId
            );

            if (!treatmentDate) {
                return res.status(404).json({
                    message: "Treatment date not found",
                    success: false,
                    status: 404
                });
            }

            // Mark the treatment date as paid and update payment status
            treatmentDate.isPaid = true;
            treatmentDate.paymentStatus = 0;  // 0 for online payment

            // Update admin amount with the payment amount
            appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount;

            // Save the updated appointment
            await appointment.save();

            // Optionally, send a confirmation or notification (if needed)
            const patient = await Patient.findById(appointment.patientId);
            // const physio = await appointment.findById(appointment.physioId);

            if (patient.physioId == appointment.physioId) {

                // physio amount update
                await Physio.findByIdAndUpdate(appointment.physioId, {
                    $inc: {
                        wallet: (paymentAmount + coin ?? 0),
                    }
                }, {
                    new: true
                });

                await Transaction.create({
                    physioId: appointment.physioId,
                    patientId: appointment.patientId,
                    appointmentId: appointment._id,
                    couponId: payment.notes.couponId,
                    amount: amount,
                    appointmentAmount: appointmentAmount,
                    transactionId: `PHONL_${generateRandomCode()}`,
                    physioTransactionType: "credit",
                    paymentStatus: "paid",
                    paymentMode: "online",
                    paidTo: "physio",
                    paidFor: "treatment",
                    treatment: true
                });

                return res.status(200).json({
                    message: "Treatment payment verified and adminAmount updated successfully",
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

                let amounts = parseFloat(appointmentAmount); // total amount
                let PlatformCharges = (amounts * platformChargesPercentage) / 100; // platform charges
                let gst = (PlatformCharges * 18) / 100; //gst charges

                // physio amount update
                physio = await Physio.findByIdAndUpdate(appointment.physioId, {
                    $inc: {
                        // wallet amount plus
                        wallet: coin ?? 0,
                    }
                }, {
                    new: true
                });

                await Transaction.create({
                    physioId: appointment.physioId,
                    patientId: appointment.patientId,
                    appointmentId: appointment._id,
                    couponId: appointment.couponId ?? null,
                    amount: amount,
                    appointmentAmount: appointmentAmount,
                    transactionId: `PHONL_${generateRandomCode()}`,
                    physioTransactionType: "credit",
                    paymentStatus: "paid",
                    paymentMode: "online",
                    paidTo: "physio",
                    paidFor: "treatment",
                    treatment: true,
                    platformCharges: PlatformCharges,
                    gstAmount: gst,
                    physioPlusAmount: PlatformCharges
                });

                return res.status(200).json({
                    message: "Treatment payment verified and adminAmount updated successfully",
                    success: true,
                    status: 200,
                    data: appointment // Return the updated appointment
                });
            }
        };


        // Prepare the payment options
        const option = {
            amount: amount * 100, // amount in the smallest currency unit (paise)
            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                appointmentId: appointmentsId,
                dateId: dateId,
                amount: amount,
                coin: coin,
                couponId: couponId ? couponId : null,
                appointmentAmount: appointmentAmount
            }
        };

        // Create the payment order using Razorpay instance
        const razorpay = await instance.orders.create(option);

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

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};

exports.verifyTreatmentSingleDayPayment = async (req, res) => {

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
            const { dateId, amount, appointmentId, coin, appointmentAmount, couponId } = payment.notes;
            const coinValue = Number(coin) || 0;
            // console.log(amount, "typeof")
            // return console.log(coin, "typeof")

            // Validate payment details
            const paymentAmount = parseFloat(amount);
            if (!dateId || isNaN(paymentAmount)) {
                return res.status(400).json({
                    message: 'Invalid dateId or amount in payment notes',
                    success: false,
                    status: 400
                });
            }

            // Fetch the appointment and populate patient details
            const appointment = await Appointment.findById(appointmentId).populate('patientId');

            if (!appointment) {
                return res.status(404).json({
                    message: "Appointment not found",
                    success: false,
                    status: 404
                });
            }

            // Check if `isTreatmentScheduled` and `treatmentDate` exist
            if (!appointment.isTreatmentScheduled || !appointment.isTreatmentScheduled.treatmentDate) {
                return res.status(400).json({
                    message: "No treatment date found for this appointment",
                    success: false,
                    status: 400
                });
            }

            // Find the treatment date corresponding to the dateId
            const treatmentDate = appointment.isTreatmentScheduled.treatmentDate.find(date =>
                date._id.toString() === dateId
            );

            if (!treatmentDate) {
                return res.status(404).json({
                    message: "Treatment date not found",
                    success: false,
                    status: 404
                });
            }

            // Mark the treatment date as paid and update payment status
            treatmentDate.isPaid = true;
            treatmentDate.paymentStatus = 0;  // 0 for online payment

            // Update admin amount with the payment amount
            appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount;

            // Save the updated appointment
            await appointment.save();

            // Optionally, send a confirmation or notification (if needed)
            const patient = await Patient.findById(appointment.patientId);
            // You can add logic to notify the patient here, if needed.

            if (coinValue) {
                const patient = await Patient.findOne({
                    _id: appointment.patientId
                });
                if (patient) {
                    // coin mains
                    patient.wallet = patient.wallet - coinValue;
                    await patient.save();
                }
            }

            const dateIds = Array.isArray(dateId) ? dateId : [dateId];
            const paidDates = (appointment?.isTreatmentScheduled?.treatmentDate || []).filter(e =>
                dateIds.some(id => e._id.equals(id))
            ).map(e => e.date);

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

            // total amount
            let PlatformCharges = (appointmentAmount * platformChargesPercentage) / 100; // platform charges
            let gst = (PlatformCharges * 18) / 100; //gst charges

            // admin amount = total amount - (platform charges + gst charges)
            console.log(` amount is: ${appointmentAmount}`, "coin =");
            console.log(`22% of the amount is: ${PlatformCharges}`);
            console.log(`18% of 22% of the amount is: ${gst}`);

            // physio amount update
            physio = await Physio.findByIdAndUpdate(appointment.physioId, {
                $inc: {
                    // wallet amount plus
                    wallet: ((appointmentAmount - (PlatformCharges + gst) + coinValue)),
                }
            }, {
                new: true
            });

            await Transaction.create({
                orderId: payment.id,
                physioId: physio._id,
                patientId: appointment.patientId,
                appointmentId: appointment._id,
                couponId: couponId,
                amount: amount,
                appointmentAmount: appointmentAmount,
                transactionId: `PHONL_${generateRandomCode()}`,
                physioTransactionType: "credit",
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
            //  finding treatment transaction check if multiple treatment transaction then they are not eligible for cashback
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
                        transactionId: treatment._id || null,
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
                message: "Treatment payment verified and adminAmount updated successfully",
                success: true,
                status: 200,
                data: appointment,/// Return the updated appointment
            });


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

        // return console.log(parseFloat(amount), "Amount")


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

            await Transaction.create({
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
                isTreatment: true,
                platformCharges: PlatformCharges,
                gstAmount: gst,
                physioPlusAmount: PlatformCharges,
                physioAmount: (paymentAmount - (PlatformCharges + gst)),
            });
            return res.status(200).json({
                message: "Treatment payment verified and adminAmount updated successfully",
                success: true,
                status: 200,
                data: appointment // Return the updated appointment
            });

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
                    appointmentAmount,
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

                await Transaction.create({
                    orderId: payment.id,
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
                    isTreatment: true
                });

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
                        const result = await sendFCMNotification(patient.deviceId, data);
                        if (!result.success) {
                            console.log("Error sending notification to physio", result);
                        }

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


exports.singleDayPaymentCash = async (req, res) => {
    try {
        const { appointmentId, dateId, appointmentAmount } = req.body;

        // Validate request data
        if (!appointmentId || !dateId) {
            return res.status(400).json({
                message: 'appointmentId and dateId are required',
                success: false,
                status: 400,
            });
        }

        // Fetch appointment details
        const appointment = await Appointment.findById(appointmentId).populate('patientId physioId');
        if (!appointment) {
            return res.status(404).json({
                message: 'Appointment not found',
                success: false,
                status: 404,
            });
        }

        // Create a new transaction entry
        const transaction = new Transaction({
            appointmentId: appointment._id,
            appointmentAmount,
            patientId: appointment.patientId,
            amount: appointment.isTreatmentScheduled.amount,
            transactionId: `PHCAS_${generateRandomCode()}`,
            patientTransactionType: 0,
            paymentMode: 'cash', // Set payment mode to cash
            treatment: true,
            paymentStatus: 'pending',
            // coin: coin,
            createdAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.ssssSS'),
            updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.ssssSS'),
        });

        await transaction.save();

        // Update the appointment with the transaction ID
        const updatedAppointment = await Appointment.findOneAndUpdate(
            {
                _id: appointmentId,
                'isTreatmentScheduled.treatmentDate._id': dateId
            },
            {
                $set: {
                    'isTreatmentScheduled.treatmentDate.$.paymentStatus': 1, // Set payment status to 1 (offline payment)
                    'isTreatmentScheduled.treatmentDate.$.transactionId': transaction._id // Store new transaction ID
                },
            },
            { new: true } // Return the updated appointment document
        ).populate('patientId physioId');

        if (!updatedAppointment) {
            return res.status(404).json({
                message: 'Appointment not found or invalid dateId',
                success: false,
                status: 404,
            });
        }

        // Return the updated appointment
        return res.status(200).json({
            message: 'Payment recorded successfully',
            success: true,
            status: 200,
            updatedAppointment,
        });
    } catch (error) {
        console.error('Error in single day payment cash:', error);
        return res.status(500).send({
            message: 'Something went wrong, please try again later',
            status: 500,
            success: false,
        });
    }
};


exports.multipleDayPaymentCash = async (req, res) => {
    try {
        const { appointmentId, dateIds, appointmentAmount } = req.body;

        // Validate input parameters
        if (!appointmentId || !dateIds || !Array.isArray(dateIds) || dateIds.length === 0) {
            console.log("Validation Error:", { appointmentId, dateIds, isArray: Array.isArray(dateIds), dateIdsLength: dateIds ? dateIds.length : null });
            return res.status(400).json({
                message: 'appointmentId and dateIds are required, and dateIds should be an array',
                success: false,
                status: 400
            });
        }

        // Find the appointment by ID
        const appointment = await Appointment.findById(appointmentId);


        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found",
                success: false,
                status: 404
            });
        }

        const { isTreatmentScheduled } = appointment;

        // Check if isTreatmentScheduled is an object
        if (!isTreatmentScheduled || typeof isTreatmentScheduled !== 'object') {
            return res.status(400).json({
                message: "isTreatmentScheduled is not a valid object",
                success: false,
                status: 400
            });
        }

        const { treatmentDate } = isTreatmentScheduled;

        // Check if treatmentDate is a valid array
        if (!Array.isArray(treatmentDate)) {
            return res.status(400).json({
                message: "treatmentDate is not a valid array",
                success: false,
                status: 400
            });
        }

        let isUpdated = false;

        // Create a new transaction entry
        const transaction = new Transaction({
            appointmentId: appointment._id,
            patientId: appointment.patientId,
            appointmentAmount,
            amount: appointmentAmount,
            transactionId: `PHCAS_${generateRandomCode()}`,
            patientTransactionType: 0,
            paymentMode: 'cash', // Set payment mode to cash
            treatment: true,
            paymentStatus: 'pending',
            // coin: coin,
            createdAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.ssssSS'),
            updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.ssssSS'),
        });

        await transaction.save();

        // Iterate over each dateId and update the payment status
        treatmentDate.forEach(treatmentDateEntry => {
            if (dateIds.includes(treatmentDateEntry._id.toString())) {
                treatmentDateEntry.paymentStatus = 1; // 1 for offline/cash payment
                treatmentDateEntry.transactionId = transaction._id; // Mark as paid
                isUpdated = true;
            }
        });

        if (isUpdated) {
            // Save the appointment after updates
            await appointment.save();

            // console.log("Updated Appointment Saved");

            return res.status(200).json({
                message: "Payments for all selected treatment dates verified successfully",
                success: true,
                status: 200
            });
        } else {
            return res.status(400).json({
                message: "No matching treatment dates found for the provided dateIds",
                success: false,
                status: 400
            });
        }
    } catch (error) {
        console.error("Error in multiple day payment cash:", error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};


// single 9Appointment
exports.singleAppointment = async (req, res) => {
    try {
        const appointmentId = req.query.appointmentId;

        const appointment = await Appointment.findById(appointmentId).populate({
            path: 'physioId',
            populate: [
                { path: 'specialization', model: 'Specialization' },
                { path: 'subscriptionId', model: 'Subscription' },
                { path: 'degree.degreeId', model: 'Degree' },
                { path: 'bptDegree.degreeId', model: 'Degree' },
                { path: 'mptDegree.degreeId', model: 'Degree' }
            ]
        }).populate('patientId');
        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found",
                status: 404,
                success: false
            });
        }

        const reviewCount = 0
        // await Review.find({ physioId: appointment.physioId._id }).countDocuments();
        // appointment._doc.reviewCount = reviewCount || 0;

        const isCashBack = await CashBack.findOne({ appointmentId: new mongoose.Types.ObjectId(appointment._id) });

        let plainAppointment = appointment.toObject(); // Convert mongoose document to plain JS object

        // Ensure isTreatmentScheduled is an object
        if (typeof plainAppointment.isTreatmentScheduled !== 'object' || plainAppointment.isTreatmentScheduled === null) {
            plainAppointment.isTreatmentScheduled = {};
        }

        // Add your custom field for response
        plainAppointment.isTreatmentScheduled.isCashBack = isCashBack;

        return res.status(200).json({
            message: "Single Appointment",
            status: 200,
            success: true,
            data: plainAppointment,
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

exports.updateCashBack = async (req, res) => {

    try {

        const { CashBackId, userUpiId } = req.query

        if (!CashBackId || !userUpiId) {
            return res.status(404).json({
                message: "CashBackId or userUpiId  is required",
                status: 404,
                success: false
            });
        }

        const isCashBack = await CashBack.findByIdAndUpdate(CashBackId, {
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
// Rehab Single Day Payment
exports.addRehabSingleDayPayment = async (req, res) => {
    try {
        const {
            appointmentsId,
            dateId,
            patientId,
            amount
        } = req.body;

        if (!appointmentsId || !dateId || !patientId || !amount) {
            return res.status(400).json({
                message: "All fields are required",
                status: 400,
                success: false
            });
        }

        // Check if IDs are valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(appointmentsId) ||
            !mongoose.Types.ObjectId.isValid(dateId) ||
            !mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({
                message: "Invalid ID(s) provided",
                status: 400,
                success: false
            });
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

        // Use aggregation to find appointment and rehab date
        const appointment = await Appointment.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(appointmentsId),
                    patientId: new mongoose.Types.ObjectId(patientId)
                }
            },
            {
                $unwind: "$isRehab"
            },
            {
                $unwind: "$isRehab.rehabDate"
            },
            {
                $match: {
                    "isRehab.rehabDate._id": new mongoose.Types.ObjectId(dateId)
                }
            },
            {
                $project: {
                    "isRehab.amount": 1,
                    "isRehab.rehabDate": 1
                }
            }
        ]);

        if (appointment.length === 0) {
            return res.status(404).json({
                message: "Appointment or rehab date not found",
                status: 404,
                success: false
            });
        }

        const rehabSchedule = appointment[0].isRehab;

        // Check if the provided amount is less than the scheduled amount
        if (amount < rehabSchedule.amount) {
            return res.status(400).json({
                message: "Insufficient balance",
                status: 400,
                success: false
            });
        }

        // Prepare the payment options
        const option = {

            amount: amount * 100,  // amount in the smallest currency unit

            currency: "INR",
            receipt: "order_rcptid_11",
            payment_capture: '1',
            notes: {
                appointmentId: appointmentsId,
                dateId: dateId,
                amount: amount,
            }
        };

        // Create the payment order using Razorpay instance
        const razorpay = await instance.orders.create(option);

        return res.status(200).json({
            message: "Payment initiated",
            status: 200,
            success: true,
            razorpay
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
// verify rehab Single Day Payment
exports.verifyRehabSingleDayPayment = async (req, res) => {
    try {


        // return console.log(req.body, "verifyRehabSingleDayPayment");  

        const {
            orderId
        } = req.body;

        if (!orderId) {
            return res.status(400).json({
                message: 'orderId is required',
                success: false,
                status: 400
            });
        }

        console.log("Order ID:", orderId); // Log order ID for debugging
        // Fetch the payment details from the payment provider
        const payment = await instance.orders.fetch(orderId);
        console.log("Payment details:", payment); // Log payment details for debugging

        if (payment.status === 'paid') {
            // Extract dateId and amount from payment notes
            const dateId = payment.notes.dateId;
            const paymentAmount = parseFloat(payment.notes.amount);
            // console.log("Date ID:", dateId); // Log date ID for debugging 


            if (!dateId || isNaN(paymentAmount)) {

                return res.status(400).json({
                    message: 'Invalid dateId or amount in payment notes',
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

            // Check if the rehab date with the given dateId exists
            const rehabDate = appointment.isRehab.find(rehab =>
                rehab.rehabDate.some(date => date._id.toString() === dateId) // Adjusted to check within rehabDate array
            );

            if (!rehabDate) {
                return res.status(404).json({
                    message: "Rehab date not found",
                    success: false,
                    status: 404
                });
            }

            // Marking the specific rehab date as paid
            const specificDate = rehabDate.rehabDate.find(date => date._id.toString() === dateId);
            specificDate.isPaid = true; // Marking it as paid

            // Save the updated appointment with the modified rehab date
            await appointment.save();

            // Update the adminAmount by adding the payment amount
            appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount; // Safely increment adminAmount
            await appointment.save(); // Save the updated appointment

            // physio amount update
            const physio = await Physio.findByIdAndUpdate(appointment.physioId, {
                $inc: {
                    // paymentAmount 22% 
                    wallet: paymentAmount * 0.22,
                }
            }, {
                new: true
            });

            // rehab amount Add by physio
            const rehabTransaction = Transaction({
                appointmentId: appointment._id,
                physioId: appointment.physioId,
                amount: paymentAmount * 0.22,
                transactionId: payment.id,
                physioTransactionType: 0,
                paymentMode: 'online',
                treatment: false,
                paymentStatus: 'paid',
                createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });
            await rehabTransaction.save();

            // rehab amount Add by patient
            const patientTransaction = Transaction({
                appointmentId: appointment._id,
                patientId: appointment.patientId,
                amount: paymentAmount,
                transactionId: payment.id,
                patientTransactionType: 1,
                paymentMode: 'online',
                treatment: false,
                paymentStatus: 'paid',
                createdAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });
            await patientTransaction.save();

            return res.status(200).json({
                message: "Rehab payment verified and adminAmount updated successfully",
                success: true,
                status: 200,
                data: appointment // Return the updated appointment
            });

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

// add rehab multiple day payment 
exports.addRehabMultipleDayPayment = async (req, res) => {
    try {
        const { appointmentId, dateIdArray, patientId, amount } = req.body;

        if (!appointmentId || !dateIdArray || !patientId || !amount) {
            return res.status(400).json({
                message: "All fields are required",
                status: 400,
                success: false
            });
        }

        // Check if each dateId is a valid ObjectId
        if (!Array.isArray(dateIdArray) || !dateIdArray.every(mongoose.Types.ObjectId.isValid)) {
            return res.status(400).json({
                message: "Invalid dateIdArray",
                status: 400,
                success: false
            });
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


        // console.log("Date ID Array:", req.body);

        // Use aggregation to find appointment and rehab dates
        const appointment = await Appointment.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(appointmentId),
                    patientId: new mongoose.Types.ObjectId(patientId)
                }
            },
            {
                $unwind: "$isRehab"
            },
            {
                $unwind: "$isRehab.rehabDate"
            },
            {
                $match: {
                    "isRehab.rehabDate._id": { $in: dateIdArray.map(id => new mongoose.Types.ObjectId(id)) }
                }
            },
            {
                $project: {
                    "isRehab.amount": 1,
                    "isRehab.rehabDate": 1
                }
            }
        ]);

        if (appointment.length === 0) {
            return res.status(404).json({
                message: "Appointment or rehab dates not found",
                status: 404,
                success: false
            });
        }

        const rehabSchedule = appointment[0].isRehab;

        // Check if the provided amount matches the scheduled amount

        if (rehabSchedule.amount == amount) {

            return res.status(400).json({
                message: "Invalid amount",
                status: 400,
                success: false
            });
        }

        // Prepare the payment options
        const options = {
            amount: amount * 100, // amount in the smallest currency unit (paise)
            currency: "INR",

            receipt: "order_rcptid_11", // Unique receipt ID

            payment_capture: '1',
            notes: {
                appointmentId: appointmentId,
                dateIdArray: dateIdArray,
                amount: amount,
            }
        };

        // Create the payment order using Razorpay instance
        const razorpay = await instance.orders.create(options);

        return res.status(200).json({
            message: "Rehab payment initiated",
            status: 200,
            success: true,
            razorpay
        });

    } catch (error) {
        console.log("Error in initiating rehab payment:", error);
        return res.status(500).json({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};

// verify rehab multiple day payment
exports.verifyRehabMultipleDayPayment = async (req, res) => {
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
            const paymentAmount = parseFloat(payment.notes.amount);

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

            // Check if each rehab date in the dateIdArray exists
            const rehabDates = appointment.isRehab.filter(rehab =>
                rehab.rehabDate.some(date => dateIdArray.includes(date._id.toString()))
            );

            if (rehabDates.length === 0) {
                return res.status(404).json({
                    message: "No matching rehab dates found",
                    success: false,
                    status: 404
                });
            }

            // Mark each specific rehab date as paid and update adminAmount
            for (const rehab of rehabDates) {
                rehab.rehabDate.forEach(date => {
                    if (dateIdArray.includes(date._id.toString())) {
                        date.isPaid = true; // Marking it as paid
                    }
                });
            }

            // Save the updated appointment with the modified rehab dates
            await appointment.save();

            // Update the adminAmount by adding the payment amount
            appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount; // Safely increment adminAmount
            await appointment.save(); // Save the updated appointment

            // Update the physio's wallet
            const physio = await Physio.findByIdAndUpdate(appointment.physioId, {
                $inc: {
                    wallet: paymentAmount * 0.22 // Update physio's wallet by 22% of paymentAmount
                }
            }, {
                new: true
            });

            // Log the rehab transaction for the physio
            const physioTransaction = new Transaction({
                appointmentId: appointment._id,
                physioId: appointment.physioId,
                amount: paymentAmount * 0.22, // Store the amount allocated to the physio
                transactionId: payment.id,
                physioTransactionType: 0,
                paymentMode: 'online',
                rehab: true,
                paymentStatus: 'paid',
                createdAt: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });
            await physioTransaction.save();

            // Log the rehab transaction for the patient
            const patientTransaction = new Transaction({
                appointmentId: appointment._id,
                patientId: appointment.patientId,
                amount: paymentAmount,
                transactionId: payment.id,
                patientTransactionType: 1,
                paymentMode: 'online',
                rehab: true,
                paymentStatus: 'paid',
                createdAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            });
            await patientTransaction.save();

            return res.status(200).json({
                message: "Rehab payments verified successfully",
                success: true,
                status: 200,
                data: appointment // Return the updated appointment
            });

        } else {
            return res.status(400).json({
                message: "Payment not successful",
                success: false,
                status: 400
            });
        }

    } catch (error) {
        console.error("Error in rehab payment verification:", error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }

};

// Appointment reschedule by patient
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
        const physio = await Physio.findById(appointment.physioId);
        const patient = await Patient.findById(appointment.patientId);

        if (physio?.deviceId && patient?.deviceId) {
            let data = {
                title: 'Consultation Rescheduled',
                body: `Your consultation with ${patient?.fullName} has been rescheduled to ${date} at ${time}.`,
                physioId: physio._id.toString(),
                type: 'appointment',
                from: 'admin',
                to: 'physio',
                for: 'physio',
                name: physio.fullName,
            }

            let result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }
            data = {}
            data.title = 'Consultation Rescheduled',
                data.type = 'appointment',
                data.from = 'admin',
                data.to = 'patient',
                data.for = 'patient',
                data.body = `Your consultation with ${physio?.fullName} has been rescheduled to ${date} at ${time}.`;
            data.patientId = patient._id.toString(),
                result = await sendFCMNotification(patient.deviceId, data);


            if (!result.success) {
                console.log("Error sending notification to patient", result);
            }
        }

        return res.status(200).json({
            message: "Appointment rescheduled successfully",
            success: true,
            status: 200
        });

    } catch (error) {
        console.log("Error in rescheduleAppointment:", error);
        return res.status(500).send({
            message: "Something went wrong, please try again later",
            status: 500,
            success: false
        });
    }
};

/**
 * @route GET /api/appointment/getAppointmentInvoice
 * @description Fetches the invoice for a specific appointment.
 * 
 * This function retrieves the invoice details associated with a given appointment ID.
 * 
 * @access Public
 * 
 * @param {string} req.query.appointmentId - The ID of the appointment for which the invoice is to be fetched.
 * @returns {Object} JSON response with success or error message and the fetched invoice.
 * 
 * @throws {Error} If the appointmentId is not provided, the invoice is not found, 
 *                 or the server encounters an error.
 */
exports.getAppointmentInvoice = async (req, res) => {
    try {
        const { appointmentId } = req.query;

        if (!appointmentId) {
            return res.status(400).json({ message: "appointmentId is required", success: false });
        }

        // Find invoice by appointment ID
        const invoice = await Invoice.findOne({ appointmentId })

        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found", success: false });
        }

        return res.status(200).json({ message: "Invoice fetched successfully", success: true, invoice });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error", success: false, error: error.message });
    }
};

/**
 * @description Creates an invoice for a specific appointment.
 * 
 * This function retrieves appointment details, checks if an invoice already exists, 
 * verifies the associated transaction, and then creates a new invoice.
 * 
 * @param {string} appointmentId - The ID of the appointment for which the invoice is to be created.
 * @returns {Object} JSON response with success or error message and the created invoice.
 * 
 * @throws {Error} If the appointmentId is not provided, the appointment is not found, 
 *                 the transaction is missing, or the server encounters an error.
 */
exports.createAppointmentInvoice = async (appointmentId, isTreatment = false) => {
    try {
        if (!appointmentId) {
            return JSON.stringify({ message: "appointmentId is required", success: false });
        }

        // Fetch appointment details
        const appointment = await Appointment.findById(appointmentId).populate('patientId physioId');
        if (!appointment) {
            return JSON.stringify({ message: "Appointment not found", success: false });
        }
        if (!appointment.transactionId) {
            return JSON.stringify({ message: "No transaction found for this appointment", success: false });
        }

        // Check if an invoice already exists
        let existingInvoice = null
        if (isTreatment) {
            existingInvoice = await Invoice.findOne({ appointmentId, type: "treatment" });
        }
        else {
            existingInvoice = await Invoice.findOne({ appointmentId });
        }

        if (existingInvoice) {
            return
        }
        // Fetch transaction details
        let query = {}

        if (isTreatment) {
            query.paidFor = "treatment",
                query.appointmentId = appointmentId
        } else {
            query._id = appointment.transactionId
        }

        const transaction = await Transaction.find(query).populate("couponId");
        if (!transaction) {
            return JSON.stringify({ message: "Transaction not found", success: false });
        }
        let amount = 0
        let totalAmount = 0
        transaction.map(txn => {
            amount += txn.amount
            totalAmount += txn.appointmentAmount
        })

        // Fetch transaction details with appointmentId and paidForDates is not []
        const transactionWithPaidDates = await Transaction.find({
            appointmentId: appointmentId,
            paidForDates: { $exists: true, $not: { $size: 0 } }
        }).populate("couponId", "couponName couponType discount");

        if (!transactionWithPaidDates) {
            return JSON.stringify({ message: "No transaction with paidForDates found", success: false });
        }

        const lastTransaction = transaction[transaction.length - 1]
        const newInvoice = new Invoice({
            appointmentId,
            type: isTreatment ? "treatment" : "appointment",
            transactionId: lastTransaction?._id,
            patientId: appointment.patientId._id,
            physioId: appointment.physioId._id,
            amount: amount,
            totalTreatmentAmount: totalAmount ?? 0,
            // appointmentAmount: lastTransaction.appointmentAmount,
            couponName: lastTransaction?.couponId?.couponName,
            couponType: lastTransaction?.couponId?.couponType,
            couponDiscount: lastTransaction?.couponId?.discount,
            patientName: appointment.patientName,
            patientAddress: appointment.patientId.appointmentAddress,
            physioName: appointment.physioId.fullName,
            physioCity: appointment.physioId.city,
            physioState: appointment.physioId.state,
            physioAddress: appointment.physioId.clinic?.zipCode || appointment.physioId.home?.zipCode || null,
            serviceType: appointment.serviceType,
            treatmentServiceType: appointment.isTreatmentScheduled?.treatmentServiceType,
            appointmentStatus: appointment.appointmentStatus,
            paymentMode: lastTransaction.paymentMode,
            treatment: isTreatment ? appointment.isTreatmentScheduled.treatmentDate?.length : null
        });

        await newInvoice.save();
        return JSON.stringify({ invoice: newInvoice });
    } catch (error) {
        console.error(error);
        return JSON.stringify({ message: "Server error", success: false, error: error.message });
    }
};


exports.addAppointmentAddress = async (req, res) => {

    const { patientId, newAppointmentAddress } = req.body

    try {

        if (!patientId || !newAppointmentAddress) {
            return res.status(400).send({
                message: "patientId  or newAppointmentAddress is required",
                status: 400,
                success: false
            });
        }

        const patient = await Patient.findById(patientId)

        if (patient) {
            // Update the patient docume()nt with the new appointment address
            if (patient.appointmentAddress !== newAppointmentAddress.toString()) {
                patient.appointmentAddress = newAppointmentAddress;
            }

            // Check if address already exists in patientAddresses
            let isAddressExists = patient.patientAddresses.some((entry) => {
                return entry.appointmentAddress === newAppointmentAddress.toString();
            });

            // If not, push the new address
            if (!isAddressExists) {
                patient.patientAddresses.push({
                    appointmentAddress: newAppointmentAddress.toString()
                });
            }

            const updatedData = await patient.save();

            return res.status(200).send({
                message: "success",
                status: 200,
                success: true,
                data: updatedData
            });
        }

        else {

            return res.status(400).send({
                message: "patientId is not found",
                status: 400,
                success: false
            });
        }
    } catch (error) {


        return res.status(500).send({
            message: "Internal server Error " + error,
            status: 500,
            success: false
        });

    }

}

exports.editAppointmentAddress = async (req, res) => {

    const { patientId, appointmentAddressId, newAppointmentAddress } = req.body

    try {

        if (!patientId || !newAppointmentAddress || !appointmentAddressId) {

            return res.status(400).send({
                message: "patientId or newAppointmentAddress or appointmentAddressId is required",
                status: 400,
                success: false
            });
        }

        const patient = await Patient.findOneAndUpdate({
            _id: patientId,
            'patientAddresses._id': appointmentAddressId

        }, {
            "patientAddresses.$.appointmentAddress": newAppointmentAddress
        }, { new: true })
        if (patient) {
            // Update the patient docume()nt with the new appointment address

            return res.status(200).send({
                message: "success",
                status: 200,
                success: true,
                data: patient
            });
        }

        else {

            return res.status(400).send({
                message: "patientId is not found",
                status: 400,
                success: false
            });
        }
    } catch (error) {


        return res.status(500).send({
            message: "Internal server Error " + error,
            status: 500,
            success: false
        });

    }

}

exports.sendNotificationForTreatment = async (req, res) => {
    try {
        const { patientId, physioId, appointmentId } = req.query;
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

        await chatroom.findOneAndUpdate({
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
