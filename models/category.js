const mongoose = require("mongoose")

const categorySchema = mongoose.Schema({
    categoryName: String,
    categoryImage: String,
    status: Number,//0-active ,1- inactive
    createdAt: Date
})

module.exports = mongoose.model("Category", categorySchema)