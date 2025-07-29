const mongoose = require('mongoose')

const requestSchema = mongoose.Schema({
    physioId: String,
    walletId: String,
    amount: Number,
    status: Number, //0-pending , 1-completed 2-rejected
    createdAt: Date
})

module.exports = mongoose.model('WithdrawlRequest', requestSchema)