const mongoose = require('mongoose')

const ftpSchema = mongoose.Schema({
    phone: String,
    pdfUrl: String,
    expiry: Number,
    amount: Number,
    paymentStatus: Number,//0-paid ,1-unpaid
    createdAt: Date
})

module.exports = mongoose.model('FTP', ftpSchema)