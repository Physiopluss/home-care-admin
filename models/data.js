const mongoose = require('mongoose')

const dataSchema = mongoose.Schema({
    degree: Array,
    createdAt: Date
})

module.exports = mongoose.model('Data', dataSchema)