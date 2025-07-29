const mongoose = require('mongoose')

const counterSchema = mongoose.Schema({
    value: {
        type: String,

    }
})

module.exports = mongoose.model('Counter', counterSchema)