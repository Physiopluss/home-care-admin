const mongoose = require('mongoose');
const moment = require('moment-timezone');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    createdAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    },
    updatedAt: {
        type: String,
        default: moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
    },
})

module.exports = mongoose.model('Event', eventSchema);