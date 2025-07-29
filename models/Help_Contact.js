const mongoose = require('mongoose');
const moment = require('moment-timezone');

const Help_ContactSchema = mongoose.Schema({
    name: {
        type: String,
    },
    email: {
        type: String,
    },
    phone: {
        type: String,
    },
    subject: {
        type: String,
    },
    messages: [{
        message: { type: String },
        date: { type: String, default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS') },
    }],
    type: {
        type: Number,  // 0--Web 1--physio 2--patient, 
    },
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Physio",
        trim: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient"
    },
    status: {
        type: Number,
        default: 0  // 0--Active, 1--Closed
    },
    createdAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    },
    updatedAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    }

});

module.exports = mongoose.model('Help_Contact', Help_ContactSchema)