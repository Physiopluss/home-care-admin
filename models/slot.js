const mongoose = require('mongoose')

const slotSchema = mongoose.Schema({
    patientId: String,
    physioId: String,
    status: Number, // 0- booked 1-available
    date: String,
    time: String,
    createdAt: Date
})

module.exports = mongoose.model('slot', slotSchema)