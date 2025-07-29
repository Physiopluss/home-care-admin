const Help_Contact = require('../../models/Help_Contact');
const Patient = require('../../models/patient')
const sendNotification = require('../../app')
const Physio = require('../../models/physio')
const moment = require('moment-timezone');
const { sendFCMNotification } = require('../../services/fcmService');


// Get All Help Contact
exports.AllHelpContacts = async (req, res) => {
    try {

        const start = moment().tz('Asia/Kolkata').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')
        const end = moment().tz('Asia/Kolkata').endOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS')


        const helpContacts = await Help_Contact.find().populate('physioId patientId');
        // get patent today help contacts count
        const patentHelpContactsCount = await Help_Contact.countDocuments({
            createdAt: {
                $gte: start,
                $lt: end
            },

            type: 2
        });

        // get physio today help contacts count
        const physioHelpContactsCount = await Help_Contact.countDocuments({
            createdAt: {
                $gte: start,
                $lt: end
            },
            type: 1
        });

        // get web today help contacts count
        const webHelpContactsCount = await Help_Contact.countDocuments({
            createdAt: {
                $gte: start,
                $lt: end
            },
            type: 0
        });


        return res.status(200).json({
            message: "All Help Contacts",
            status: 200,
            success: true,
            patentHelpContactsCount,
            physioHelpContactsCount,
            webHelpContactsCount,
            date: moment().tz('Asia/Kolkata').startOf('day').format('yyyy-MM-DDTHH:mm:ss.SSSSSS'),
            data: helpContacts
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
};

// Update Help Contact status
exports.UpdateHelpContactStatus = async (req, res) => {
    try {
        const { Id } = req.query;
        if (!Id) {
            return res.status(400).json({ message: 'Help Contact ID is required', status: 400, success: false });
        }

        const helpContact = await Help_Contact.findByIdAndUpdate(
            Id,
            { status: 1 },
            { new: true }
        );

        let physio = null;
        if (helpContact.physioId) {
            physio = await Physio.findById(helpContact.physioId);
            if (!physio) {
                return res.status(404).json({
                    message: 'Physio not found',
                    status: 404,
                    success: false
                });
            }
        }

        let patient = null;
        if (helpContact.patientId) {
            patient = await Patient.findById(helpContact.patientId);
            if (!patient) {
                return res.status(404).json({
                    message: 'Patient not found',
                    status: 404,
                    success: false
                });
            }
        }

        // Send notification to physio
        if (physio) {
            let data = {
                title: "🆘 Help & Support Request!",
                body: `Your Ticket is update and marked as closed. View Request`,
                physioId: physio._id.toString(),
                type: 'support',
                from: 'admin',
                to: 'physio',
                for: 'physio'
            }

            let result = await sendFCMNotification(physio.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to physio", result);
            }
        }

        // Send notification to patient
        if (patient) {
            let data = {
                title: "🆘 Help & Support Request!",
                body: `Your Ticket is update and marked as closed. View Request`,
                patientId: patient._id.toString(),
                type: 'support',
                from: 'admin',
                to: 'patient',
                for: 'patient'
            }

            let result = await sendFCMNotification(patient.deviceId, data)

            if (!result.success) {
                console.log("Error sending notification to patient", result);
            }
        }

        return res.status(200).json({
            message: "Help Contact status updated",
            status: 200,
            success: true,
            data: helpContact
        });
    } catch (error) {
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}



