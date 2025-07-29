const mongoose = require('mongoose')


const otpSchema = mongoose.Schema({
    phone: String,
    otp: String,
    createdAt: { type: Date, default: Date.now, index: { expires: 300 } }
})
// otp schema 

module.exports = mongoose.model('Otp', otpSchema)