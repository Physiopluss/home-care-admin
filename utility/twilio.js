// const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
});

module.exports = client;