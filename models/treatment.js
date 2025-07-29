const mongoose = require('mongoose')
const moment = require('moment-timezone');

const treatmentSchema = mongoose.Schema({
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Physio'
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    },
    dates: {
        type: Array,
        default: []
    },
    timing: {
        from: String,
        to: String
    },
    mode: String,
    feePerDay: Number,
    notes: String,
    status: Number, // 0-- active 1--completed
    paidPayments: Array, // array of dates on which payment is done 
    createdAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    },
    updatedAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    }
})

module.exports = mongoose.model('Treatment', treatmentSchema)