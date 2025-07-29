const mongoose = require('mongoose');
const moment = require('moment-timezone');

const CashBackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        default: null
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },
    rewardAmount: {
        type: Number,
        default: null
    },
    userUpiId: {
        type: String,
        default: null,
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        default: null
    },
    rewardPercentage: {
        type: String,
        default: '0%',
    },
    status: {
        type: String,
        enum: ['pending', 'process', 'success'],
        default: 'pending',
    },
    expiresAt: {
        type: Date,
        default: () => moment().tz('Asia/Kolkata').add(2, 'days').toDate(),
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('CashBack', CashBackSchema);
