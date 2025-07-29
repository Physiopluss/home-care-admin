const mongoose = require('mongoose')

const dynamicDataSchema = mongoose.Schema({
    name: String,
    icon: String,
    createdAt: Date
})

module.exports = mongoose.model('Specialization', dynamicDataSchema)