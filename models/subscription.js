const mongoose = require('mongoose');
const moment = require('moment-timezone');

// 🔁 This line is important to avoid MissingSchemaError
require('../models/plan'); // Ensure Plan model is registered

const subscriptionSchema = mongoose.Schema({
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan'
    },
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Physio'
    },
    amount: {
        type: Number,
        default: 0
    },
    orderId: {
        type: String,
        default: null
    },
    paymentStatus: {
        type: Number,
        default: 0
    },
    patientCount: {
        type: Number,
        default: 0
    },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    startAt: {
        type: Date,
        default: null
    },
    expireAt: {
        type: Date,
        index: { expires: 0 },
        default: () => moment().add(30, 'days').toDate()
    }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
