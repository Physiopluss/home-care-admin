const mongoose = require("mongoose")

const orderSchema = mongoose.Schema({
        userId: String,
        products: Array, // [{ "productId":"","productTitle":"","quantity","price":"","varientId":"","varientTitle":"" }]  array like as
        orderedAt: Date,
        totalPrice: String,
        deliveredAt: String,
        isDiscountCouponApplied: Number,//0-yes , 1-no
        discountCoupon: String,
        fullName: String,
        phone: String,
        address: {
                flat_house_building: String,
                street_colony: String,
                pinCode: String,
                city: String,
                state: String,
                landmark: String
        },
        orderStatus: Number, //0- ordered, 1-out for delivery, 2- delivered, 3-canceled             
})

module.exports = mongoose.model("Order", orderSchema)