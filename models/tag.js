const mongoose = require('mongoose')

const tagsSchema = mongoose.Schema({
    tags: Array
})

module.exports = mongoose.model('tag', tagsSchema)