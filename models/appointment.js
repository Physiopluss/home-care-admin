const mongoose = require('mongoose')

const appointmentSchema = mongoose.Schema({

    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
        trim: true,
        default: null
        // validate
    },
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Physio",
        trim: true,
        default: null
    },
    // to store id for after creating requestTreatment
    requestConsultationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "requestAppointment",
    },
    appointmentStatus: {
        type: Number, // 0-- Appointment  1-- Treatment Scheduled 2-- Rehab  // 3--Cancelled
        default: 0
    },
    appointmentCompleted: {
        type: Boolean,
        default: false
    },
    date: {
        type: String,
        trim: true,
        default: ""
    },
    time: {
        type: String,
        trim: true,
        default: ""
    },
    reminderSent: {
        type: Boolean,
        default: false,
    },
    patientName: {
        type: String,
        trim: true,
        default: ""
    },
    age: {
        type: Number,
        trim: true,
        default: ""
    },
    phone: {
        type: String,
        trim: true,
        default: ""
    },
    gender: {
        type: Number, // 0-female 1-male 2-other
        enum: [0, 1, 2],
        default: 0
    },
    painNotes: {
        type: String,
        default: ""
    },
    // physioNotes:String,
    amount: {
        type: Number,
        default: ""
    },
    orderId: {
        type: String,
        default: ""
    },
    prescriptionNotes: {
        type: String,
        default: ""
    },
    isRated: {
        type: Boolean,
        default: false
    }, //true,false
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
        default: null
    },
    paymentMode: {
        type: String, // 0--online, 1--offline
        default: ""
    },
    bookingSource: {
        type: String,
        enum: ['mobile', 'website', 'admin'],
        default: 'mobile'
    },
    isTreatmentRequested: {
        type: Boolean,
        default: false
    },
    isTreatmentScheduled: {
        isTreatmentRequest:
        {
            type: Boolean,
            default: false
        },
        isTreatmentTransfer: {
            type: Boolean,
            default: false
        },
        treatmentDate: [
            {
                date: {
                    type: String,
                    trim: true,
                    default: null
                },
                isPaid: {
                    type: Boolean,
                    default: false
                },
                paymentMode: {
                    type: String, // 0--online, 1--offline
                    default: null
                },
            }
        ],
        startTime: {
            type: String,
            trim: true,
            default: ""
        },
        endTime: {
            type: String,
            trim: true,
            default: ""
        },
        status: {
            type: Number, // 0--booked, 1--completed
            default: 0,
            enum: [0, 1]
        },
        prescriptionNotes: {
            type: String,
            default: ""
        },
        amount: {
            type: Number,
            default: ""
        },
        isTreatmentCompleted: {
            type: Boolean,
            default: false
        }
    },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
        trim: true,
        default: null
    },
    adminAmount: {
        type: Number,
        default: 0
    },
    isRescheduled: {
        type: Boolean,
        default: false
    },
    otp: {
        type: Number,
    },
    otpStatus: {
        type: Boolean,
        default: false
    },
    isAppointmentRequest:
    {
        type: Boolean,
        default: false
    },
    isAppointmentTransfer: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

module.exports = mongoose.model('Appointment', appointmentSchema)