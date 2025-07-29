const mongoose = require("mongoose")

const productSchema = mongoose.Schema({
    categoryId: String,
    productName: String,
    productImage: Array,
    productDesc: String,
    price: String,
    status: Number, //0-active 1-inactive
    createdAt: Date
})

module.exports = mongoose.model("Rroduct", productSchema)