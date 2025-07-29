const mongoose = require('mongoose')

const appSettingSchema = mongoose.Schema({
     privarcyPolicy: String,
     termAndCondition: String,
     supportContact: String
})

module.exports = mongoose.model('AppSetting', appSettingSchema)