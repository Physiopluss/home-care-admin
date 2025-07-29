const mongoose = require('mongoose')

const reviewSchema = mongoose.Schema({
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
    },
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Physio",
        trim: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
        trim: true
    },
    // reviewBy:String,
    rating: {
        type: Number
    },
    comment: {
        type: String
    },
    adminReview: {
        type: Boolean,
        default: false
    },
    name: { type: String },
    image: { type: String },
}, {
    timestamps: true
})

module.exports = mongoose.model('Review', reviewSchema)