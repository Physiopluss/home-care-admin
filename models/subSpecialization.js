const mongoose = require('mongoose')

const dynamicDataSchema = mongoose.Schema({
    specializationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Specialization'
    },
    name: String,
    createdAt: Date
})

module.exports = mongoose.model('Subspecialization', dynamicDataSchema)