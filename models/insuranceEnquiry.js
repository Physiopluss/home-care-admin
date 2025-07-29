const mongoose = require('mongoose')

const InsuranceEnquiry = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    policyNumber: {
        type: String,
        required: true
    },
    callStatus: {
        type: Number,
        enum: [0, 1], // 0- notcalled 1-called
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('InsuranceEnquiry', InsuranceEnquiry)