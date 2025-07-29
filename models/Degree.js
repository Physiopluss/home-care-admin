const mongoose = require('mongoose');

const degreeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Degree', degreeSchema);
