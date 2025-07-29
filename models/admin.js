const mongoose = require('mongoose')

const adminSchema = mongoose.Schema({
    email: String,
    password: String,
    adminName: String,
    adminImage: String,
    phone: String
})

module.exports = mongoose.model('Admin', adminSchema)