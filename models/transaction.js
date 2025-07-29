const mongoose = require("mongoose")

const transactionSchema = mongoose.Schema({
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        default: null
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        default: null
    },
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Physio',
        default: null
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null
    },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    transactionId: {
        type: String,
        default: null
    },
    appointmentAmount: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        required: true
    },
    wallet: {
        type: Number,
        default: 0
    },
    orderId: {
        type: String,
        default: null
    },
    paidForDates: {
        type: Array,
        default: []
    },
    paidFor: {
        type: String,
        enum: ["appointment", "treatment", "subscription", "debt", "other"],    // debt for physio wallet amount for cash payments
        default: null
    },
    paidTo: {
        type: String,
        enum: ["physio", "patient", "physioPlus"],
        default: "physio"
    },
    physioTransactionType: {
        type: String,
        enum: ["credit", "debit", "withdraw"],
        default: null
    },
    patientTransactionType: {
        type: String,
        enum: ["credit", "debit"],
        default: null
    },
    paymentMode: {
        type: String,
        enum: ['wallet', 'online', 'cash', 'cash/voucher', 'online/voucher', 'coin', 'online/coin'],
        default: 'online'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    isTreatment: {
        type: Boolean,
        default: false
    },
    platformCharges: {
        type: Number,
        default: 0
    },
    physioPlusAmount: {
        type: Number,
        default: 0
    },
    gstAmount: {
        type: Number,
        default: 0
    },
    physioAmount: {
        type: Number,
        default: 0
    }
}, { timestamps: true })

module.exports = mongoose.model('Transaction', transactionSchema)