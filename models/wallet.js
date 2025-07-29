const mongoose = require('mongoose')

const walletSchema = mongoose.Schema({
    physioId: String,
    balance: Number,

})

module.exports = mongoose.model('Wallet', walletSchema)