const mongoose = require('mongoose')
const moment = require('moment-timezone');

const couponSchema = mongoose.Schema({
    couponCode: {
        type: String,
    },
    couponName: {
        type: String
    },
    discount: {
        type: Number  // in percentage as 10,20,30,40,50 and Price as 100,200,300,400,500
    },
    couponType: {
        type: Number  // 0--price 1--percentage
    },
    usageLimit: {
        type: Number
    },
    usageCount: {
        type: Number,
        default: 0
    },
    status: {
        type: Number  // 0-- active 1--inactive
    },
    startDate: {
        type: String
    },
    endDate: {
        type: String
    },
    couponPlace: {
        type: Number  // 0-- Patient 1--Physio
    },
    message: {
        type: String
    },
    physioId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Physio'
    }],
    patientId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    }],
    createdAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    },
    updatedAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    }
})

module.exports = mongoose.model('Coupon', couponSchema)
