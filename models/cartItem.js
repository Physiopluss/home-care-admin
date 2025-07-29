const mongoose = require("mongoose")

const cartItemSchema = mongoose.Schema({
    userId: String,
    cartId: String,
    productId: String,
    productTitle: String,
    productImage: Array,
    price: String,
    quantity: Number,
    createdAt: Date
})

module.exports = mongoose.model("CartItem", cartItemSchema)