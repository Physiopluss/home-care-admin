const mongoose = require('mongoose');
// const physio = require('./physio');


const likeSchema = mongoose.Schema({
    blogId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Blog",
        trim: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
        trim: true
    },
    like: {
        type: Boolean,
        default: false
    },
    physioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Physio",
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Like', likeSchema)