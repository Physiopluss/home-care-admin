const nodemailer = require("nodemailer");

// Zoho SMTP configuration
const transporter = nodemailer.createTransport({
    host: "smtp.zoho.in",
    port: 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Sends an appointment confirmation email with the provided appointment details.
 *
 * @param {Object} params - Email configuration and appointment details.
 * @param {Object} params.data - Appointment data to include in the email.
 * @param {string} [params.to=process.env.EMAIL_USER] - Recipient email address.
 * @param {string} [params.from=`"PhysioCare" <${process.env.EMAIL_USER}>`] - Sender information.
 * @param {string} [params.subject='Alert! New Appointment Booked'] - Email subject line.
 *
 * @returns {Promise<void>} - A Promise that resolves when the email is sent.
 */
const sendAppointmentEmail = async ({
    data,
    to = process.env.EMAIL_USER,
    from = `"PhysioCare" <${process.env.EMAIL_USER}>`,
    subject = `Alert! New Appointment Booked`,
}) => {
    const mailOptions = {
        from,
        to,
        subject,
        html: `
      <h2>Appointment Confirmed!</h2>
      <p><strong>Patient Name:</strong> ${data.patientName}</p>
      <p><strong>Patient Phone:</strong> ${data.patientPhone}</p>
      <p><strong>Physio Name:</strong> ${data.physioName}</p>
      <p><strong>Physio Phone:</strong> ${data.physioPhone}</p>
      <p><strong>Date:</strong> ${data.date}</p>
      <p><strong>Time:</strong> ${data.timeInString}</p>
      <p><strong>Amount Paid:</strong> ₹${data.amount}</p>
      <br/>
    `,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendAppointmentEmail;
