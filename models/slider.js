const mongoose = require('mongoose');

const sliderSchema = mongoose.Schema({
    Image:{
        type:String,
        required:true
    },
    status:{
        type:Number,
        default:0
    }

},{timestamps:true})

module.exports = mongoose.model('Slider', sliderSchema);