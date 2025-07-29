const Review = require("../../models/review");
const Appointment = require("../../models/appointment");
const jwt = require("jsonwebtoken");
const Physio = require('../../models/physio');
const Patient = require('../../models/patient');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const Coupon = require('../../models/coupon');
const Transaction = require('../../models/transaction');
const Subscription = require('../../models/subscription');
const generateRandomCode = require('../../utility/generateRandomCode');
const PhysioHelper = require('../../utility/physioHelper');
const { sendFCMNotification } = require('../../services/fcmService');
const sendAppointmentEmail = require('../../services/sendEmail');
const CashBack = require('../../models/cashBack');

const moment = require('moment')
const {
  msg91OTP
} = require('msg91-lib');
const { GiveCashBack, CashBackCacheKey } = require('../../utility/cashBackUtility');
const { redisClient } = require('../../utility/redisClient');
const invoice = require("../../models/invoice");

var instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// generate random code

const generateRandomOTP = () => {
  return Math.floor(1000 + Math.random() * 9000); // Generates a number between 1000 and 9999
};

generateRandomCode()
const msg91otp = new msg91OTP({
  authKey: process.env.MSG91_AUTH_KEY,
  templateId: process.env.MSG91_TEMP_ID
});


exports.signUpOtp = async (req, res) => {
  const {
    phone
  } = req.body;
  let otp = generateRandomCode()
  try {
    await Patient.findOne({
      phone: `+91${phone}`
    }).then(
      async (patientData) => {
        if (patientData) {
          res
            .status(409)
            .json({
              status: true,
              message: "patient already exists please login",
            });
        } else {
          const response = await msg91otp.send(`91${phone}`)
          // console.log("response", response)
          // res.json(response)


          if (response.type === "success") {

            res
              .status(200)
              .json({
                status: true,
                message: "otp sent successfully"
                // message: "",
              });
          } else {
            res.status(200).json({
              status: true,
              message: "otp not sent"
            })
          }
        }
      }
    );
  } catch (error) {
    res.status(400).json({
      status: false,
      message: "otp not sent"
    });
  }
};

exports.loginOtp = async (req, res) => {
  const {
    phone
  } = req.body;
  try {

    let user = await Patient.findOne({
      phone: `+91${phone}`
    })

    // return console.log(user)

    patientData = await Patient.findOne({
      phone: `+91${phone}`
    }).then(
      async (patientData) => {

        if (!patientData) {
          res
            .status(409) // 409 is for conflict
            .json({
              status: true,
              message: "patient does'nt exists please register",
            });
        } else {
          const response = await msg91otp.send(`91${phone}`)
          // res.json(response)

          if (response.type === "success") {
            res
              .status(200)
              .json({
                status: true,
                message: "OTP sent successfully"
              });
          } else {
            res.status(200).json({ status: true, message: "otp not sent" })
          }
        }
      }
    );
  } catch (error) {
    res.status(400).json({
      status: false,
      message: "otp not sent"
    });
  }
};

exports.verifyOtp = async (req, res) => {
  const Otp = req.body.otp;
  const phone = req.body.phone;
  const deviceId = req.body.deviceId;
  const patientData = await Patient.findOne({
    phone: `+91${phone}`
  });
  try {
    if (patientData) {
      const response = await msg91otp.verify(`91${phone}`, Otp)

      if (response.type === "success") {
        jwt.sign({ patient: patientData }, process.env.JWT_SECRET_KEY, (err, token) => {

          res.status(200).json({ status: true, newUser: false, message: "otp verified successfully", token: token, data: patientData })
        });

      } else if (response.type !== "success" || Otp !== "1234") {
        res.status(400).json(
          {
            status: true,
            message: "entered wrong otp"
          }
        )
      }
    }
    else {
      const response = await msg91otp.verify(`91${phone}`, Otp)
      // console.log(response)
      if (response.type === "success") {
        // Add patient
        const newPatient = await new Patient({
          phone: `+91${phone}`,
          deviceId: deviceId,
          fullName: req.body.fullName ? req.body.fullName : "",
          dob: req.body.dob ? req.body.dob : "",
          gender: req.body.gender ? req.body.gender : "",
        });
        await newPatient.save();

        jwt.sign({ patient: newPatient }, process.env.JWT_SECRET_KEY, (err, token) => {

          res.status(200).json({ status: true, newUser: true, message: "otp verified successfullyddd", token: token, data: newPatient, user: "Signup" })

        });
      } else {

        res.status(400).json({ status: true, message: "entered wrong otp" })
      }
    }
  } catch (err) {
    res.status(400).json({
      status: true,
      message: "entered wrong otp"
    });
  }
};

// get patent by id
exports.patientById = async (req, res) => {
  try {
    const patientId = req.query.patientId;
    if (!patientId) {
      return res.status(400).json({ message: "No patientId provided", status: 400, success: false });
    }
    const patientData = await Patient.findById(patientId);
    if (!patientData) {
      return res.status(200).json({ message: "Patient not found", status: 200, success: false });
    }
    return res.status(200).json({ message: "Patient details", status: 200, success: true, data: patientData });
  } catch (err) {
    return res.status(500).json({ message: "Something went wrong. Please try again", status: 500, success: false });
  }
};


exports.editProfile = async (req, res) => {
  console.log(req.body);

  try {
    const patientId = req.params.id;
    const thePatient = await Patient.findOne({ _id: patientId });

    if (!thePatient) {
      return res.status(400).json({
        status: false,
        message: "No patient exists with this Id",
      });
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        profilePhoto: req.body.image || thePatient.profilePhoto,
        fullName: req.body.fullName || thePatient.fullNaprofilePhotome,
        dob: req.body.dob || thePatient.dob,
        gender: req.body.gender || thePatient.gender,
        address: req.body.address || thePatient.address,
        appointmentAddress: req.body.address || thePatient.appointmentAddress,
        latitude: req.body.latitude || thePatient.latitude,
        longitude: req.body.longitude || thePatient.longitude,
        country: req.body.country?.toLowerCase() || thePatient.country,
        state: req.body.state?.toLowerCase() || thePatient.state,
        city: req.body.city?.toLowerCase() || thePatient.city,
        zipCode: req.body.pincode || thePatient.zipCode,
        onboardedFrom: "mobile",
      },
      { new: true }
    );

    return res.status(200).json({
      status: true,
      message: "Profile updated successfully",
      data: updatedPatient,
    });
  }
  catch (error) {
    console.error("Error in editProfile:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong",
    });
  }
};

exports.getPatientAppointments = async (req, res) => {
  try {
    // console.log(req.params);
    console.log(req.query);
    const {
      patientId,
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
      "isTreatmentScheduled.isTreatmentTransfer": true
      // ...(appointmentCompleted !== undefined && { appointmentCompleted }),
      // ...(appointmentStatus !== undefined && { appointmentStatus }),
      // ...(isTreatmentCompleted !== undefined && { "isTreatmentScheduled.isTreatmentCompleted": isTreatmentCompleted })
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

    // // Append cashback info
    // for (const apt of plainAppointments) {
    //   const isCashBack = await CashBack.findOne({
    //     appointmentId: new mongoose.Types.ObjectId(apt._id)
    //   });

    //   if (isCashBack) {
    //     if (!apt.isTreatmentScheduled || typeof apt.isTreatmentScheduled !== 'object') {
    //       apt.isTreatmentScheduled = {};
    //     }

    //     // Add a clean cashback flag or full cashback doc
    //     apt.isTreatmentScheduled.isCashBack = isCashBack; // or isCashBack if full doc needed
    //   }
    // }

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

exports.getPatientTreatments = async (req, res) => {
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
      appointmentStatus: 1,
      ...(appointmentCompleted !== undefined && { appointmentCompleted }),
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

exports.singleAppointment = async (req, res) => {
  console.log(req.query);
  console.log(req.params);
  console.log(req.body);
  try {
    const appointmentId = req.query.consultationId;

    const appointment = await Appointment.findById(appointmentId).populate({
      path: 'physioId',
      populate: [
        { path: 'specialization', model: 'Specialization' },
        { path: 'subscriptionId', model: 'Subscription' },
        { path: 'degree.degreeId', model: 'Degree' },
        { path: 'bptDegree.degreeId', model: 'Degree' },
        { path: 'mptDegree.degreeId', model: 'Degree' },
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
exports.singleTreatment = async (req, res) => {
  try {
    const appointmentId = req.query.treatmentId;

    const appointment = await Appointment.findOne({ _id: appointmentId, appointmentStatus: 1, "isTreatmentScheduled.isTreatmentTransfer": true }).populate({
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

exports.getInvoice = async (req, res) => {
  try {
    const { appointmentId, type } = req.query;
    if (!appointmentId) {
      return res.status(400).json({
        message: 'appointmentId is required',
        status: 400,
      });
    }

    console.log("the", req.query);


    const appointment = Appointment.findById(appointmentId)

    if (!appointment) {
      return res.status(400).json({
        message: 'appointmentId is not found',
        status: 400,
      });
    }



    const invoices = await invoice.findOne({
      appointmentId: appointmentId,
      type: type
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

exports.addRatingToPhysio = async (req, res) => {
  const {
    orderId,
    rating,
  } = req.body;

  const theAppointment = await Appointment.findById(orderId);
  if (theAppointment.isRated === true) {
    return res
      .status(400)
      .json({
        status: false,
        message: "you already rated this appointment"
      });
  }
  Review
  const newReview = await new Review({
    physioId: theAppointment.physioId,
    patientId: theAppointment.patientId,
    rating: rating,
  });
  await newReview.save();
  await Appointment.findByIdAndUpdate(
    orderId, {
    isRated: true,
  }, {
    new: true
  }
  );
  return res
    .status(201)
    .json({
      status: true,
      message: "review added successfully",
      data: newReview,
    });

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


exports.sendNotificationForTreatment = async (req, res) => {
  try {
    console.log(req.query);
    console.log(req.body);
    console.log(req.params);
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


    const result = await sendFCMNotification(isPhysio.deviceId, notificationData)
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


exports.addTreatmentPayment = async (req, res) => {
  try {
    const {
      appointmentsId,
      dateIds,
      patientId,
      amount,
      isRazorpay,
      coin,
      appointmentAmount,
      couponId
    } = req.body;

    if (!appointmentsId || !dateIds || !patientId || !amount) {
      return res.status(400).json({
        message: "appointmentsId, patientId, amount and dateIds are required",
        status: 400,
        success: false
      });
    }

    const treatmentDateIds = Array.isArray(dateIds) ? dateIds : [dateIds];

    for (const id of treatmentDateIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: `Invalid dateId: ${id}`,
          status: 400,
          success: false
        });
      }
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found", status: 404, success: false });
    }

    if (couponId) {
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        return res.status(400).json({ message: 'Coupon not found', status: 400, success: false });
      }
    }

    const paymentAmount = parseFloat(amount);
    const appointment = await Appointment.findById(appointmentsId).populate('patientId');
    if (!appointment?.isTreatmentScheduled?.treatmentDate) {
      return res.status(404).json({ message: "Appointment or treatment data not found", status: 404, success: false });
    }

    const treatmentDates = appointment.isTreatmentScheduled.treatmentDate.filter(t =>
      treatmentDateIds.includes(t._id.toString())
    );

    if (treatmentDates.length === 0) {
      return res.status(404).json({ message: "No matching treatment dates found", status: 404, success: false });
    }

    if (isRazorpay == false || isRazorpay == "false") {
      treatmentDates.forEach(t => {
        t.isPaid = true;
        t.paymentStatus = 0;
      });

      appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount;
      await appointment.save();

      const physio = await Physio.findById(appointment.physioId).populate({
        path: 'subscriptionId',
        populate: { path: 'planId' }
      }).lean();

      if (!physio) {
        return res.status(404).json({ message: 'Physio not found', status: 404, success: false });
      }

      const planType = physio.subscriptionId?.planId?.planType;
      const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);
      const platformCharges = (appointmentAmount * platformChargesPercentage) / 100;
      const gst = (platformCharges * 18) / 100;

      await Physio.findByIdAndUpdate(physio._id, {
        $inc: {
          wallet: (coin || 0) + (paymentAmount - (platformCharges + gst))
        }
      });

      await Transaction.create({
        physioId: appointment.physioId,
        patientId: appointment.patientId,
        appointmentId: appointment._id,
        couponId,
        amount: paymentAmount,
        appointmentAmount,
        transactionId: `PHONL_${generateRandomCode()}`,
        physioTransactionType: "credit",
        paymentStatus: "paid",
        paymentMode: "online",
        paidTo: "physio",
        paidFor: "treatment",
        isTreatment: true,
        platformCharges,
        gstAmount: gst,
        physioPlusAmount: platformCharges,
        physioAmount: paymentAmount - (platformCharges + gst)
      });

      return res.status(200).json({
        message: "Treatment payment verified and adminAmount updated",
        success: true,
        status: 200,
        data: appointment
      });
    }

    // Razorpay flow
    const razorpay = await instance.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `order_${Date.now()}`,
      payment_capture: '1',
      notes: {
        physioId: appointment.physioId,
        patientId,
        patientName: patient.fullName,
        patientPhone: patient.phone,
        appointmentId: appointmentsId,
        dateIdArray: treatmentDateIds,
        amount,
        coin,
        couponId: couponId ?? null,
        appointmentAmount
      }
    });

    if (couponId) {
      await Coupon.findByIdAndUpdate(
        couponId,
        { $addToSet: { patientId } },
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
    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
      status: 500,
      error
    });
  }
};


exports.verifyTreatmentPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'orderId is required', success: false, status: 400 });
    }

    const payment = await instance.orders.fetch(orderId);

    if (payment.status !== 'paid') {
      return res.status(400).json({ message: 'Payment not completed yet', success: false, status: 400 });
    }

    const notes = payment.notes;
    const {
      appointmentId,
      patientId,
      amount,
      appointmentAmount,
      coin,
      couponId,
      dateIdArray
    } = notes;

    const treatmentDateIds = Array.isArray(dateIdArray) ? dateIdArray : [dateIdArray];

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment?.isTreatmentScheduled?.treatmentDate) {
      return res.status(404).json({ message: "Appointment or treatment data not found", success: false, status: 404 });
    }

    const treatmentDates = appointment.isTreatmentScheduled.treatmentDate.filter(t =>
      treatmentDateIds.includes(t._id.toString())
    );

    if (treatmentDates.length === 0) {
      return res.status(404).json({ message: "No matching treatment dates found", success: false, status: 404 });
    }

    treatmentDates.forEach(t => {
      t.isPaid = true;
      t.paymentStatus = 0;
    });

    appointment.adminAmount = (appointment.adminAmount || 0) + Number(amount);
    await appointment.save();

    const physio = await Physio.findById(appointment.physioId).populate({
      path: 'subscriptionId',
      populate: { path: 'planId' }
    }).lean();

     const patient = await Patient.findById(appointment.patientId)

    if (!physio && !patient) {
      return res.status(404).json({ message: 'Physio not found', success: false, status: 404 });
    }

    const newamount = Number(amount)
    const platformCharges = (newamount * 22) / 100;
    const gst = (platformCharges * 18) / 100;

    await Physio.findByIdAndUpdate(physio._id, {
      $inc: { wallet: (- (platformCharges + gst)) }
    });


    const txn = await Transaction.create({
      physioId: appointment.physioId,
      patientId,
      appointmentId,
      couponId,
      amount: Number(amount),
      appointmentAmount,
      transactionId: `RAZOR_${generateRandomCode()}`,
      physioTransactionType: "credit",
      paymentStatus: "paid",
      paymentMode: "online",
      paidTo: "physio",
      paidFor: "treatment",
      isTreatment: true,
      platformCharges,
      gstAmount: gst,
      physioPlusAmount: platformCharges,
      physioAmount: Number(amount) - (platformCharges + gst)
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


    return res.status(200).json({
      message: "Payment verified successfully",
      status: 200,
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Something went wrong",
      success: false,
      status: 500,
      error
    });
  }
};


// exports.addTreatmentSingleDayPayment = async (req, res) => {
//   console.log('Single' + JSON.stringify(req.body));
//   try {
//     const {
//       appointmentsId,
//       dateId,
//       patientId,
//       amount,
//       isRazorpay,
//       coin,
//       appointmentAmount,
//       couponId
//     } = req.body;
//     // return console.log(req.body, "req.body");

//     if (!appointmentsId || !dateId || !patientId || !amount) {
//       return res.status(400).json({
//         message: "All fields are required",
//         status: 400,
//         success: false
//       });
//     }

//     // if check dateId valid objectid
//     if (!mongoose.Types.ObjectId.isValid(dateId)) {
//       return res.status(400).json({
//         message: "Invalid dateId",
//         status: 400,
//         success: false
//       });
//     }

//     let paymentAmount = parseFloat(amount);

//     // Check if the patient exists
//     const patient = await Patient.findById(patientId);
//     if (!patient) {
//       return res.status(404).json({
//         message: "Patient not found",
//         status: 404,
//         success: false
//       });
//     }

//     if (couponId) {
//       const coupon = await Coupon.findById(couponId);
//       if (!coupon) return res.status(400).json({
//         message: 'Coupon not found',
//         success: false,
//         status: 400
//       });
//     }

//     // Use aggregation to find appointment and treatment date
//     const appointment = await Appointment.aggregate([{
//       $match: {
//         _id: new mongoose.Types.ObjectId(appointmentsId),
//         patientId: new mongoose.Types.ObjectId(patientId)
//       }
//     },
//     {
//       $unwind: "$isTreatmentScheduled"
//     },
//     {
//       $unwind: "$isTreatmentScheduled.treatmentDate"
//     },
//     {
//       $match: {
//         "isTreatmentScheduled.treatmentDate._id": new mongoose.Types.ObjectId(dateId)
//       }
//     },
//     {
//       $project: {
//         "isTreatmentScheduled.amount": 1,
//         "isTreatmentScheduled.treatmentDate": 1
//       }
//     }
//     ]);

//     if (appointment.length === 0) {
//       return res.status(404).json({
//         message: "Appointment or treatment date not found",
//         status: 404,
//         success: false
//       });
//     }

//     const treatmentSchedule = appointment[0].isTreatmentScheduled;

//     // Check if the provided amount is less than the scheduled amount
//     if (treatmentSchedule.amount === amount) {
//       return res.status(400).json({
//         message: "Insufficient balance",
//         status: 400,
//         success: false
//       });
//     }

//     if (isRazorpay == false || isRazorpay == "false") {
//       const appointment = await Appointment.findById(appointmentsId).populate('patientId');

//       if (!appointment) {
//         return res.status(404).json({
//           message: "Appointment not found",
//           success: false,
//           status: 404
//         });
//       }

//       // Check if `isTreatmentScheduled` and `treatmentDate` exist
//       if (!appointment.isTreatmentScheduled || !appointment.isTreatmentScheduled.treatmentDate) {
//         return res.status(400).json({
//           message: "No treatment date found for this appointment",
//           success: false,
//           status: 400
//         });
//       }

//       // Find the treatment date corresponding to the dateId
//       const treatmentDate = appointment.isTreatmentScheduled.treatmentDate.find(date =>
//         date._id.toString() === dateId
//       );

//       if (!treatmentDate) {
//         return res.status(404).json({
//           message: "Treatment date not found",
//           success: false,
//           status: 404
//         });
//       }

//       // Mark the treatment date as paid and update payment status
//       treatmentDate.isPaid = true;
//       treatmentDate.paymentStatus = 0;  // 0 for online payment

//       // Update admin amount with the payment amount
//       appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount;

//       // Save the updated appointment
//       await appointment.save();

//       // Optionally, send a confirmation or notification (if needed)
//       const patient = await Patient.findById(appointment.patientId);
//       // const physio = await appointment.findById(appointment.physioId);

//       if (patient.physioId == appointment.physioId) {

//         // physio amount update
//         await Physio.findByIdAndUpdate(appointment.physioId, {
//           $inc: {
//             wallet: (paymentAmount + coin ?? 0),
//           }
//         }, {
//           new: true
//         });

//         await Transaction.create({
//           physioId: appointment.physioId,
//           patientId: appointment.patientId,
//           appointmentId: appointment._id,
//           couponId: payment.notes.couponId,
//           amount: amount,
//           appointmentAmount: appointmentAmount,
//           transactionId: `PHONL_${generateRandomCode()}`,
//           physioTransactionType: "credit",
//           paymentStatus: "paid",
//           paymentMode: "online",
//           paidTo: "physio",
//           paidFor: "treatment",
//           treatment: true
//         });

//         return res.status(200).json({
//           message: "Treatment payment verified and adminAmount updated successfully",
//           success: true,
//           status: 200,
//           data: appointment // Return the updated appointment
//         });
//       } else {
//         let physio = await Physio.findById(appointment.physioId).populate({
//           path: 'subscriptionId',
//           populate: { path: 'planId' }
//         }).lean();

//         if (!physio) {
//           return res.status(404).json({
//             message: 'Physio not found',
//             success: false,
//             status: 404
//           });
//         }

//         const planType = physio.subscriptionId.planId.planType
//         const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

//         let amounts = parseFloat(appointmentAmount); // total amount
//         let PlatformCharges = (amounts * platformChargesPercentage) / 100; // platform charges
//         let gst = (PlatformCharges * 18) / 100; //gst charges

//         // physio amount update
//         physio = await Physio.findByIdAndUpdate(appointment.physioId, {
//           $inc: {
//             // wallet amount plus
//             wallet: coin ?? 0,
//           }
//         }, {
//           new: true
//         });

//         await Transaction.create({
//           physioId: appointment.physioId,
//           patientId: appointment.patientId,
//           appointmentId: appointment._id,
//           couponId: appointment.couponId ?? null,
//           amount: amount,
//           appointmentAmount: appointmentAmount,
//           transactionId: `PHONL_${generateRandomCode()}`,
//           physioTransactionType: "credit",
//           paymentStatus: "paid",
//           paymentMode: "online",
//           paidTo: "physio",
//           paidFor: "treatment",
//           treatment: true,
//           platformCharges: PlatformCharges,
//           gstAmount: gst,
//           physioPlusAmount: PlatformCharges
//         });

//         return res.status(200).json({
//           message: "Treatment payment verified and adminAmount updated successfully",
//           success: true,
//           status: 200,
//           data: appointment // Return the updated appointment
//         });
//       }
//     };


//     // Prepare the payment options
//     const option = {
//       amount: amount * 100, // amount in the smallest currency unit (paise)
//       currency: "INR",
//       receipt: "order_rcptid_11",
//       payment_capture: '1',
//       notes: {
//         appointmentId: appointmentsId,
//         dateId: dateId,
//         amount: amount,
//         coin: coin,
//         couponId: couponId ? couponId : null,
//         appointmentAmount: appointmentAmount
//       }
//     };

//     // Create the payment order using Razorpay instance
//     const razorpay = await instance.orders.create(option);

//     if (couponId) {
//       await Coupon.findByIdAndUpdate(
//         couponId,
//         {
//           $addToSet: {
//             patientId: patientId
//           }
//         },
//         { new: true }
//       );
//     }

//     return res.status(200).json({
//       message: "Payment initiated",
//       status: 200,
//       success: true,
//       razorpay
//     });

//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({
//       message: "Something went wrong, please try again later",
//       status: 500,
//       success: false
//     });
//   }
// };

// exports.verifyTreatmentSingleDayPayment = async (req, res) => {

//   try {
//     const { orderId } = req.body;
//     if (!orderId) {
//       return res.status(400).json({
//         message: 'orderId is required',
//         success: false,
//         status: 400
//       });
//     }

//     // Fetch the payment details from the payment provider
//     const payment = await instance.orders.fetch(orderId);

//     if (payment.status === 'paid') {
//       const { dateId, amount, appointmentId, coin, appointmentAmount, couponId } = payment.notes;
//       const coinValue = Number(coin) || 0;
//       // console.log(amount, "typeof")
//       // return console.log(coin, "typeof")

//       // Validate payment details
//       const paymentAmount = parseFloat(amount);
//       if (!dateId || isNaN(paymentAmount)) {
//         return res.status(400).json({
//           message: 'Invalid dateId or amount in payment notes',
//           success: false,
//           status: 400
//         });
//       }

//       // Fetch the appointment and populate patient details
//       const appointment = await Appointment.findById(appointmentId).populate('patientId');

//       if (!appointment) {
//         return res.status(404).json({
//           message: "Appointment not found",
//           success: false,
//           status: 404
//         });
//       }

//       // Check if `isTreatmentScheduled` and `treatmentDate` exist
//       if (!appointment.isTreatmentScheduled || !appointment.isTreatmentScheduled.treatmentDate) {
//         return res.status(400).json({
//           message: "No treatment date found for this appointment",
//           success: false,
//           status: 400
//         });
//       }

//       // Find the treatment date corresponding to the dateId
//       const treatmentDate = appointment.isTreatmentScheduled.treatmentDate.find(date =>
//         date._id.toString() === dateId
//       );

//       if (!treatmentDate) {
//         return res.status(404).json({
//           message: "Treatment date not found",
//           success: false,
//           status: 404
//         });
//       }

//       // Mark the treatment date as paid and update payment status
//       treatmentDate.isPaid = true;
//       treatmentDate.paymentStatus = 0;  // 0 for online payment

//       // Update admin amount with the payment amount
//       appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount;

//       // Save the updated appointment
//       await appointment.save();

//       // Optionally, send a confirmation or notification (if needed)
//       const patient = await Patient.findById(appointment.patientId);
//       // You can add logic to notify the patient here, if needed.

//       if (coinValue) {
//         const patient = await Patient.findOne({
//           _id: appointment.patientId
//         });
//         if (patient) {
//           // coin mains
//           patient.wallet = patient.wallet - coinValue;
//           await patient.save();
//         }
//       }

//       const dateIds = Array.isArray(dateId) ? dateId : [dateId];
//       const paidDates = (appointment?.isTreatmentScheduled?.treatmentDate || []).filter(e =>
//         dateIds.some(id => e._id.equals(id))
//       ).map(e => e.date);

//       let physio = await Physio.findById(appointment.physioId).populate({
//         path: 'subscriptionId',
//         populate: { path: 'planId' }
//       }).lean();

//       if (!physio) {
//         return res.status(404).json({
//           message: 'Physio not found',
//           success: false,
//           status: 404
//         });
//       }

//       const planType = physio.subscriptionId.planId.planType
//       const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

//       // total amount
//       let PlatformCharges = (appointmentAmount * platformChargesPercentage) / 100; // platform charges
//       let gst = (PlatformCharges * 18) / 100; //gst charges

//       // admin amount = total amount - (platform charges + gst charges)
//       console.log(` amount is: ${appointmentAmount}`, "coin =");
//       console.log(`22% of the amount is: ${PlatformCharges}`);
//       console.log(`18% of 22% of the amount is: ${gst}`);

//       // physio amount update
//       physio = await Physio.findByIdAndUpdate(appointment.physioId, {
//         $inc: {
//           // wallet amount plus
//           wallet: ((appointmentAmount - (PlatformCharges + gst) + coinValue)),
//         }
//       }, {
//         new: true
//       });

//       await Transaction.create({
//         orderId: payment.id,
//         physioId: physio._id,
//         patientId: appointment.patientId,
//         appointmentId: appointment._id,
//         couponId: couponId,
//         amount: amount,
//         appointmentAmount: appointmentAmount,
//         transactionId: `PHONL_${generateRandomCode()}`,
//         physioTransactionType: "credit",
//         paymentStatus: "paid",
//         paymentMode: "online",
//         paidTo: "physio",
//         paidFor: "treatment",
//         platformCharges: PlatformCharges,
//         gstAmount: gst,
//         physioPlusAmount: PlatformCharges,
//         physioAmount: (amount - (PlatformCharges + gst)),
//         isTreatment: true
//       });
//       const cacheKey = CashBackCacheKey()
//       let patientCount = await redisClient.get(cacheKey);
//       patientCount = parseInt(patientCount) || 0;

//       let CashBackData = null;

//       let data = {
//         physioId: patient._id.toString(),
//         title: "Payment Confirmed",
//         body: 'Your payment is successful, and you have received a scratch card.',
//         type: "treatment",
//         from: "admin",
//         to: "patient",
//         for: "patient",
//         name: patient.fullName.toString(),
//       }
//       //  finding treatment transaction check if multiple treatment transaction then they are not eligible for cashback
//       const CheckTransaction = await Transaction.find({ appointmentId: appointment._id, paidFor: 'treatment' }).countDocuments()

//       if (appointment.isTreatmentScheduled.treatmentDate.length > 0) {
//         const allPaid = appointment.isTreatmentScheduled.treatmentDate.every((obj) => obj.isPaid === true);
//         if (allPaid && CheckTransaction === 1) {
//           patientCount += 1;

//           const result = await sendFCMNotification(patient.deviceId, data);
//           if (!result.success) {
//             console.log("Error sending notification to physio", result);
//           }

//           let obj = {
//             userId: appointment.patientId || null,
//             appointmentId: appointment._id || null,
//             transactionId: treatment._id || null,
//           }
//           if (patientCount === 15) {
//             obj.rewardPercentage = "70%"
//             obj.rewardAmount = (Number(paymentAmount || 0) * 70) / 100
//             CashBackData = await GiveCashBack(obj);
//             patientCount = 0; // reset after 15th
//           } else {
//             obj.rewardPercentage = "5%"
//             obj.rewardAmount = (Number(paymentAmount || 0) * 5) / 100
//             CashBackData = await GiveCashBack(obj);


//           }

//           await redisClient.set(cacheKey, patientCount);
//         }
//       }

//       // Send Payment Confirmed Notification to Physio
//       data = {
//         physioId: physio._id.toString(),
//         title: "Payment Confirmed",
//         body: `Your treatment payment has been confirmed with ${patient?.fullName ?? "the patient"}`,
//         type: "treatment",
//         from: "admin",
//         to: "physio",
//         for: "physio",
//         name: physio.fullName.toString(),
//       }

//       const result = await sendFCMNotification(physio.deviceId, data);
//       if (!result.success) {
//         console.log("Error sending notification to physio", result);
//       }

//       return res.status(200).json({
//         message: "Treatment payment verified and adminAmount updated successfully",
//         success: true,
//         status: 200,
//         data: appointment,/// Return the updated appointment
//       });


//     } else {
//       return res.status(400).json({
//         message: "Payment not successful",
//         success: false,
//         status: 400
//       });
//     }

//   } catch (error) {
//     console.error("Error in payment verification:", error);
//     return res.status(500).send({
//       message: "Something went wrong, please try again later",
//       status: 500,
//       success: false
//     });
//   }
// };


// exports.addTreatmentMultipleDayPayment = async (req, res) => {
//   try {
//     const {
//       appointmentsId,
//       dateIdArray,
//       patientId,
//       amount,
//       isRazorpay,
//       coin,
//       appointmentAmount,
//       couponId
//     } = req.body;

//     // return console.log(parseFloat(amount), "Amount")


//     // Validate inputs
//     if (!appointmentsId || !dateIdArray || !patientId || !amount || !Array.isArray(dateIdArray)) {

//       return res.status(400).json({
//         message: "All fields are required and dateIdArray must be an array",
//         status: 400,
//         success: false
//       });
//     }

//     // Validate dateIdArray elements
//     for (const id of dateIdArray) {
//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({
//           message: `Invalid dateId: ${id}`,
//           status: 400,
//           success: false
//         });
//       }
//     }

//     // Check if the patient exists
//     const patient = await Patient.findById(patientId);
//     if (!patient) {
//       return res.status(404).json({
//         message: "Patient not found",
//         status: 404,
//         success: false
//       });
//     }

//     if (couponId) {
//       const coupon = await Coupon.findById(couponId);
//       if (!coupon) return res.status(400).json({
//         message: 'Coupon not found',
//         success: false,
//         status: 400
//       });
//     }

//     // Use aggregation to find appointment and treatment dates
//     const appointments = await Appointment.aggregate([{
//       $match: {
//         _id: new mongoose.Types.ObjectId(appointmentsId),
//         patientId: new mongoose.Types.ObjectId(patientId)
//       }
//     },
//     {
//       $unwind: "$isTreatmentScheduled"
//     },
//     {
//       $unwind: "$isTreatmentScheduled.treatmentDate"
//     },
//     {
//       $match: {
//         "isTreatmentScheduled.treatmentDate._id": {
//           $in: dateIdArray.map(id => new mongoose.Types.ObjectId(id))
//         }
//       }
//     },
//     {
//       $project: {
//         "isTreatmentScheduled.amount": 1,
//         "isTreatmentScheduled.treatmentDate": 1
//       }
//     }
//     ]);


//     if (appointments.length === 0) {
//       return res.status(404).json({
//         message: "Appointment or treatment dates not found",
//         status: 404,
//         success: false
//       });
//     }

//     let paymentAmount = parseFloat(amount);

//     const treatmentSchedules = appointments.map(app => app.isTreatmentScheduled);

//     // Check if the provided amount is sufficient for all scheduled treatments
//     // for (let treatmentSchedule of treatmentSchedules) {
//     //     if (treatmentSchedule.amount > amount) {

//     //         // console.log(treatmentSchedule.amount, amount, "treatmentSchedule.amount > amount");

//     //         return res.status(400).json({
//     //             message: `Insufficient balance for date ${treatmentSchedule.treatmentDate._id}`,
//     //             status: 400,
//     //             success: false
//     //         });
//     //     }
//     // }

//     if (isRazorpay == false || isRazorpay == "false") {
//       // const dateIdArray = dateIdArray; // Ensure this is an array in notes


//       // return console.log( paymentAmount, "amount")

//       if (!Array.isArray(dateIdArray) || isNaN(paymentAmount)) {
//         return res.status(400).json({
//           message: 'Invalid dateIdArray or amount in payment notes',
//           success: false,
//           status: 400
//         });
//       }

//       // Use findById to find the appointment
//       const appointment = await Appointment.findById(appointmentsId);

//       if (!appointment) {
//         return res.status(404).json({
//           message: "Appointment not found",
//           success: false,
//           status: 404
//         });
//       }

//       // Check if treatmentDate exists in the appointment
//       if (!appointment.isTreatmentScheduled || !Array.isArray(appointment.isTreatmentScheduled.treatmentDate)) {
//         return res.status(400).json({
//           message: "No treatment dates found in appointment",
//           success: false,
//           status: 400
//         });
//       }

//       // Check if each treatment date in the dateIdArray exists
//       const treatmentDates = appointment.isTreatmentScheduled.treatmentDate.filter(treatment =>
//         dateIdArray.includes(treatment._id.toString()) // Ensure you are matching the correct ID
//       );

//       if (treatmentDates.length === 0) {
//         return res.status(404).json({
//           message: "No matching treatment dates found",
//           success: false,
//           status: 404
//         });
//       }

//       // Mark each specific treatment date as paid and update adminAmount
//       treatmentDates.forEach(treatment => {
//         treatment.isPaid = true; // Marking it as paid
//         treatment.paymentStatus = 0; // paymentStatus 0-online 1-offline
//       });

//       // Save the updated appointment with the modified treatment dates
//       await appointment.save();

//       // Update the adminAmount by adding the payment amount
//       appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount; // Safely increment adminAmount
//       await appointment.save(); // Save the updated appointment

//       // Optionally, you can notify the patient here (if required)
//       // const patient = await Patient.findById(appointment.patientId);
//       // Add logic to send notifications if needed.
//       const patient = await Patient.findById(appointment.patientId);
//       if (!patient) {
//         return res.status(404).json({
//           message: "Patient not found",
//           success: false,
//           status: 404
//         });
//       }

//       const physio = await Physio.findById(appointment.physioId).populate({
//         path: 'subscriptionId',
//         populate: { path: 'planId' }
//       }).lean();

//       if (!physio) {
//         return res.status(404).json({
//           message: 'Physio not found',
//           success: false,
//           status: 404
//         });
//       }

//       const planType = physio.subscriptionId.planId.planType
//       const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

//       let amounts = parseFloat(appointmentAmount); // total amount
//       let PlatformCharges = (amounts * platformChargesPercentage) / 100; // platform charges
//       let gst = (PlatformCharges * 18) / 100; //gst charges

//       // physio amount update
//       await Physio.findByIdAndUpdate(appointment.physioId, {
//         $inc: {
//           // wallet amount plus
//           wallet: coin,
//         }
//       }, {
//         new: true
//       });

//       await Physio.findByIdAndUpdate(
//         physio._id,
//         {
//           $inc: { wallet: (appointmentAmount - (PlatformCharges + gst)) },
//         }
//       );

//       await Transaction.create({
//         physioId: appointment.physioId,
//         patientId: appointment.patientId,
//         appointmentId: appointment._id,
//         couponId: couponId,
//         amount: paymentAmount,
//         appointmentAmount: appointmentAmount,
//         transactionId: `PHONL_${generateRandomCode()}`,
//         physioTransactionType: "credit",
//         paymentStatus: "paid",
//         paymentMode: "online",
//         paidTo: "physio",
//         paidFor: "treatment",
//         isTreatment: true,
//         platformCharges: PlatformCharges,
//         gstAmount: gst,
//         physioPlusAmount: PlatformCharges,
//         physioAmount: (paymentAmount - (PlatformCharges + gst)),
//       });
//       return res.status(200).json({
//         message: "Treatment payment verified and adminAmount updated successfully",
//         success: true,
//         status: 200,
//         data: appointment // Return the updated appointment
//       });

//     }
//     else {

//       // Prepare the payment options for Razorpay
//       const paymentOptions = {
//         amount: amount * 100, // total amount in the smallest currency unit (paise)
//         currency: "INR",
//         receipt: "order_rcptid_11",
//         payment_capture: '1',
//         notes: {
//           appointmentId: appointmentsId,
//           dateIdArray: dateIdArray,
//           amount: parseFloat(amount),
//           coin: coin,
//           couponId: couponId ? couponId : null,
//           appointmentAmount,
//         }
//       };

//       // Create the payment order using Razorpay instance
//       const razorpay = await instance.orders.create(paymentOptions);

//       if (couponId) {
//         await Coupon.findByIdAndUpdate(
//           couponId,
//           {
//             $addToSet: {
//               patientId: patientId
//             }
//           },
//           { new: true }
//         );
//       }

//       return res.status(200).json({
//         message: "Payment initiated",
//         status: 200,
//         success: true,
//         razorpay
//       });
//     }

//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({
//       message: "Something went wrong, please try again later",
//       status: 500,
//       success: false,
//       error: error
//     });
//   }
// };

// // verify treatment multiple day payment
// exports.verifyTreatmentMultipleDayPayment = async (req, res) => {
//   try {
//     const { orderId } = req.body;

//     if (!orderId) {
//       return res.status(400).json({
//         message: 'orderId is required',
//         success: false,
//         status: 400
//       });
//     }

//     // Fetch the payment details from the payment provider
//     const payment = await instance.orders.fetch(orderId);

//     if (payment.status === 'paid') {
//       // Extract dateIdArray and amount from payment notes
//       const dateIdArray = payment.notes.dateIdArray; // Ensure this is an array in notes
//       const paymentAmount = payment.notes.amount;
//       const couponId = payment.notes.couponId
//       const coin = payment.notes.coin;
//       const coinValue = Number(coin) || 0;
//       const appointmentAmount = payment.notes.appointmentAmount;
//       // return console.log( paymentAmount, "amount")

//       if (!Array.isArray(dateIdArray) || isNaN(paymentAmount)) {
//         return res.status(400).json({
//           message: 'Invalid dateIdArray or amount in payment notes',
//           success: false,
//           status: 400
//         });
//       }

//       // Use findById to find the appointment
//       const appointment = await Appointment.findById(payment.notes.appointmentId);

//       if (!appointment) {
//         return res.status(404).json({
//           message: "Appointment not found",
//           success: false,
//           status: 404
//         });
//       }

//       // Check if treatmentDate exists in the appointment
//       if (!appointment.isTreatmentScheduled || !Array.isArray(appointment.isTreatmentScheduled.treatmentDate)) {
//         return res.status(400).json({
//           message: "No treatment dates found in appointment",
//           success: false,
//           status: 400
//         });
//       }

//       // Check if each treatment date in the dateIdArray exists
//       const treatmentDates = appointment.isTreatmentScheduled.treatmentDate.filter(treatment =>
//         dateIdArray.includes(treatment._id.toString()) // Ensure you are matching the correct ID
//       );

//       if (treatmentDates.length === 0) {
//         return res.status(404).json({
//           message: "No matching treatment dates found",
//           success: false,
//           status: 404
//         });
//       }

//       // Mark each specific treatment date as paid and update adminAmount
//       treatmentDates.forEach(treatment => {
//         treatment.isPaid = true; // Marking it as paid
//         treatment.paymentStatus = 0; // paymentStatus 0-online 1-offline
//       });

//       // Save the updated appointment with the modified treatment dates
//       await appointment.save();

//       // Update the adminAmount by adding the payment amount
//       appointment.adminAmount = (appointment.adminAmount || 0) + paymentAmount; // Safely increment adminAmount
//       await appointment.save(); // Save the updated appointment

//       // Optionally, you can notify the patient here (if required)
//       const patient = await Patient.findById(appointment.patientId);
//       // Add logic to send notifications if needed.

//       if (!patient) {
//         return res.status(404).json({
//           message: "Patient not found",
//           success: false,
//           status: 404
//         });
//       }

//       const paidDates = (appointment?.isTreatmentScheduled?.treatmentDate || []).filter(e =>
//         dateIdArray.some(id => e._id.equals(id))
//       ).map(e => e.date);

//       if (patient.physioId == appointment.physioId) {
//         // Update the physio amount
//         await Physio.findByIdAndUpdate(appointment.physioId, {
//           $inc: {
//             adminAmount: paymentAmount // Update physio's admin amount by 22% of paymentAmount
//           }
//         }, {
//           new: true
//         });

//         await Transaction.create({
//           orderId: payment.id,
//           physioId: appointment.physioId,
//           patientId: appointment.patientId,
//           appointmentId: appointment._id,
//           couponId: couponId,
//           amount: paymentAmount,
//           appointmentAmount: appointmentAmount,
//           transactionId: `PHONL_${generateRandomCode()}`,
//           physioTransactionType: "credit",
//           paymentStatus: "paid",
//           paymentMode: "online",
//           paidTo: "physio",
//           paidFor: "treatment",
//           paidForDates: paidDates,
//           isTreatment: true
//         });

//         const physio = await Physio.findById(payment.notes.physioId);
//         await physio.findByIdAndUpdate(physio._id, { $inc: { wallet: payment.amount / 100 } });

//         return res.status(200).json({
//           message: "Treatment payments verified successfully",
//           success: true,
//           status: 200,
//           data: appointment // Return the updated appointment
//         });
//       } else {
//         let physio = await Physio.findById(appointment.physioId).populate({
//           path: 'subscriptionId',
//           populate: { path: 'planId' }
//         }).lean();

//         if (!physio) {
//           return res.status(404).json({
//             message: 'Physio not found',
//             success: false,
//             status: 404
//           });
//         }

//         const planType = physio.subscriptionId.planId.planType
//         const platformChargesPercentage = PhysioHelper.getPlatformCharges(planType);

//         let amount = parseInt(appointmentAmount); // total amount
//         let PlatformCharges = (amount * platformChargesPercentage) / 100; // platform charges
//         let gst = (PlatformCharges * 18) / 100; //gst charges

//         // Update the physio amount
//         physio = await Physio.findByIdAndUpdate(appointment.physioId, {
//           $inc: {
//             adminAmount: ((amount - (PlatformCharges + gst) + coinValue)) // Update physio's admin amount by 22% of paymentAmount
//           }
//         }, {
//           new: true
//         });


//         await Physio.findByIdAndUpdate(
//           physio._id,
//           {
//             $inc: { wallet: (appointmentAmount - (PlatformCharges + gst)) },
//           }
//         );


//         const transaction = await Transaction.create({
//           physioId: appointment.physioId,
//           patientId: appointment.patientId,
//           appointmentId: appointment._id,
//           couponId: couponId,
//           amount: paymentAmount,
//           appointmentAmount: appointmentAmount,
//           transactionId: `PHONL_${generateRandomCode()}`,
//           physioTransactionType: "credit",
//           paymentStatus: "paid",
//           paymentMode: "online",
//           paidTo: "physio",
//           paidFor: "treatment",
//           paidForDates: paidDates,
//           isTreatment: true,
//           platformCharges: PlatformCharges,
//           gstAmount: gst,
//           physioPlusAmount: PlatformCharges,
//           physioAmount: (paymentAmount - (PlatformCharges + gst)),
//         });

//         const cacheKey = CashBackCacheKey()
//         let patientCount = await redisClient.get(cacheKey);
//         patientCount = parseInt(patientCount) || 0;

//         let CashBackData = null;

//         let data = {
//           physioId: patient._id.toString(),
//           title: "Payment Confirmed",
//           body: 'Your payment is successful, and you have received a scratch card.',
//           type: "treatment",
//           from: "admin",
//           to: "patient",
//           for: "patient",
//           name: patient.fullName.toString(),
//         }
//         const CheckTransaction = await Transaction.find({ appointmentId: appointment._id, paidFor: 'treatment' }).countDocuments()
//         if (appointment.isTreatmentScheduled.treatmentDate.length > 0) {
//           const allPaid = appointment.isTreatmentScheduled.treatmentDate.every((obj) => obj.isPaid === true);

//           if (allPaid && CheckTransaction === 1) {
//             patientCount += 1;

//             let obj = {
//               userId: appointment.patientId || null,
//               appointmentId: appointment._id || null,
//               transactionId: transaction._id || null,
//             }
//             if (patientCount === 15) {
//               obj.rewardPercentage = "70%"
//               obj.rewardAmount = (Number(paymentAmount || 0) * 70) / 100
//               CashBackData = await GiveCashBack(obj);
//               patientCount = 0; // reset after 15th
//             } else {
//               obj.rewardPercentage = "5%"
//               obj.rewardAmount = (Number(paymentAmount || 0) * 5) / 100
//               CashBackData = await GiveCashBack(obj);
//             }

//             await redisClient.set(cacheKey, patientCount);
//             const result = await sendFCMNotification(patient.deviceId, data);
//             if (!result.success) {
//               console.log("Error sending notification to physio", result);
//             }

//           }
//         }

//         // Send Payment Confirmed Notification to Physio
//         data = {
//           physioId: physio._id.toString(),
//           title: "Payment Confirmed",
//           body: `Your treatment payment has been confirmed with ${patient?.fullName ?? "the patient"}`,
//           type: "treatment",
//           from: "admin",
//           to: "physio",
//           for: "physio",
//           name: physio.fullName.toString(),
//         }

//         const result = await sendFCMNotification(physio.deviceId, data);
//         if (!result.success) {
//           console.log("Error sending notification to physio", result);
//         }

//         return res.status(200).json({
//           message: "Treatment payments verified successfully",
//           success: true,
//           status: 200,
//           data: appointment,
//         });
//       }

//     } else {
//       return res.status(400).json({
//         message: "Payment not successful",
//         success: false,
//         status: 400
//       });
//     }

//   } catch (error) {
//     console.error("Error in payment verification:", error);
//     return res.status(500).send({
//       message: "Something went wrong, please try again later",
//       status: 500,
//       success: false
//     });
//   }
// };


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


// Get Coupons By code
exports.GetCouponByCode = async (req, res) => {
  try {
    const {
      couponName,
      patientId
    } = req.body;
    if (!couponName) {
      return res.status(400).json({
        message: "Coupon Name is required",
        status: 400,
        success: false
      });
    }

    if (!patientId) {
      return res.status(400).json({
        message: "patientId is required",
        status: 400,
        success: false
      });
    }

    // if coupon code is valid
    const coupon = await Coupon.findOne({
      couponName: new RegExp(couponName?.trim(), 'i'),
      couponPlace: 1,
      status: 0
    });

    if (!coupon) {
      return res.status(400).json({
        message: "Invalid Coupon code",
        status: 400,
        success: false
      });
    }

    const constAlreadyUsed = coupon.patientId.some((id) => id.equals(patientId))

    if (constAlreadyUsed) {
      return res.status(400).json({
        message: "Coupon code is already used",
        status: 400,
        success: false
      });
    }
    let today = moment().format('YYYY-MM-DDTHH:mm:ss.SSSSSS');

    // if check if coupon end date is greater than today
    if (coupon.endDate < today) {
      return res.status(400).json({
        message: "Coupon code expired",
        status: 400,
        success: false
      });
    }

    return res.status(200).json({
      message: "Coupon code fetched successfully",
      status: 200,
      success: true,
      data: coupon
    });

  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong" + error,
      status: 500,
      success: false
    });
  }
};


