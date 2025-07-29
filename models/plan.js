const mongoose = require('mongoose')

const planSchema = mongoose.Schema({
    name: String,
    benefits: String,
    price: Number,
    discountPrice: Number,
    planType: {
        type: Number,
        default: 0,
        unique: true
    },
    planMonth: Number,
    status: {
        type: Number,
        default: 0
    },
    patientLimit: Number
}, { timestamps: true })

module.exports = mongoose.model('Plan', planSchema)
