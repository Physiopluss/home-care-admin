const mongoose = require('mongoose');

const multiplierSchema = new mongoose.Schema({
    thumbnail: {
        type: String,
        required: true
    },
    image: [{
        type: String,
        required: true
    }],
    title: {
        type: String,
        required: true
    },
}, { timestamps: true });

module.exports = mongoose.model('Multiplier', multiplierSchema);