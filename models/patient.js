const mongoose = require('mongoose')

const patientSchema = mongoose.Schema({
    fullName: {
        type: String,
        trim: true,
        default: null
    },
    phone: {
        type: String,
        // unique: true,
        trim: true,
        default: null
    },
    googleId: {
        type: String,
        default: null
    },
    dob: {
        type: String,
        default: null
    },
    gender: {
        type: Number,
        default: null
    },  // 0-female 1-male 2-other
    profilePhoto: {
        type: String,
        default: null
    },
    country: {
        type: String,
        default: null
    },
    state: {
        type: String,
        default: null
    },
    city: {
        type: String,
        default: null
    },
    zipCode: {
        type: Number,
        default: null
    },
    area: {
        type: String,
        default: null
    },
    address: {
        type: String,
        default: null
    },
    appointmentAddress: {
        type: String,
        default: null
    },
    patientAddresses: [
        {
            appointmentAddress: {
                type: String,
                default: null
            }
        }
    ],
 // 0-active , 1-suspend
    deviceId: {
        type: String,
    },
    latitude: {
        type: String,
        default: null
    },
    longitude: {
        type: String,
        default: null
    },
    liked: Array,
    webToken: {
        type: String,
        default: null
    },
    appToken: {
        type: String,
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    wallet: {
        type: Number,
        default: 0.00
    },
    addCoinBanner: {
        type: Boolean,
        default: true,
    },
    onboardedFrom: {
        type: String,
        enum: ['web', 'mobile', 'admin', 'other'],
        default: 'other'
    }
}, { timestamps: true })

module.exports = mongoose.model('Patient', patientSchema)
