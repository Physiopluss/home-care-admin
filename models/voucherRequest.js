const mongoose = require('mongoose')
const moment = require('moment-timezone');

const voucherRequestSchema = mongoose.Schema({
    bannerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Banner'
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    },
    name: {
        type: String
    },
    age: {
        type: Number
    },
    Participation: {
        type: String
    },
    status: {
        type: Number,
        enum: [0, 1, 2], // 0--pending 1--approved 2--rejected
        default: 0
    },
    coin: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: String,
        default: () => moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    },
    updatedAt: {
        type: String,
        default: () => moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    }
});

module.exports = mongoose.model('VoucherRequest', voucherRequestSchema);