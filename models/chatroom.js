const mongoose = require('mongoose');
const moment = require('moment-timezone');
// Define the Chat schema
const chatSchema = new mongoose.Schema({
  physioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Physio',
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
  },
  messages: [{
    message: {
      type: String
    },
    sender: {
      type: String,
    },
    attachment: {
      type: String
    },
    isRead: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: String,
      default: () => moment().tz('Asia/Kolkata').format("h:mm A")
    }
  }],
  blocked: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: String,
    default: () => moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
  },
  updatedAt: {
    type: String,
    default: () => moment().tz('Asia/Kolkata').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
  }
});
// Create the Chat model
module.exports = mongoose.model('Chat', chatSchema);