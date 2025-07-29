const mongoose = require('mongoose');

const refundRequestSchema = new mongoose.Schema({
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Physio',
        default: null
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        default: null
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        default: null
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        default: null
    },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    upiId: {
        type: String,
        default: null
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    refundAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'rejected'],
        default: 'pending'
    },
    refundType: {
        type: String,
        enum: ['subscription', 'appointment', 'treatment', 'coupon'],
        required: true
    },
    description: {
        type: String,
        default: null
    },
    reason: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('RefundRequest', refundRequestSchema);
