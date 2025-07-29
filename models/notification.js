const mongoose = require('mongoose');

const notificationSchema = mongoose.Schema({
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Physio',
        default: null
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        default: null
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['appointment', 'treatment', 'withdrawal', 'editRequest', 'onboarding', 'subscription', 'support', 'other'],
        required: true
    },
    from: {             // `from` is reserved keyword in Firebase Cloud Messaging avoid sending it as a field name
        type: String,
        enum: ['physio', 'patient', 'admin', 'all'],
        required: true
    },
    to: {
        type: String,
        enum: ['physio', 'patient', 'admin', 'all'],
        required: true
    },
    for: {              // explicitly define the notification for whom
        type: String,
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true
})

// Add TTL index: auto-delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Notification', notificationSchema)
