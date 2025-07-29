const mongoose = require('mongoose');
const bannerSchema = mongoose.Schema({
  title: {
    type: String,
    trim: true,
    default: null,
  },
  image: {
    type: String,
    required: true,
  },
  isLive: {
    type: Boolean,
    default: false,
  },
  platform: {
    type: [String],
    enum: ['patient', 'physio', 'website'],
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Banner', bannerSchema);
