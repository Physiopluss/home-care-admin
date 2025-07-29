const { default: mongoose } = require('mongoose')
const notification = require('../models/notification')
const Patient = require('../models/patient')
const Physio = require('../models/physio')


/**
 * @route GET  api/UnreadNotificationCount
 * @description  getCount of UnreadNotificationCount Patinet or Physio
 * @access public
 * @param {string}  ID - req.query.physioId or req.query.physioId
 * @returns {object} Json response with suceess or error and the fetched invoice.
 * @throws {Error} if the patient id  or physioid id  is not exixsts
 */

UnreadNotificationCount = async (req, res) => {
    try {

        const { physioId, patientId } = req.query

        let query = {}


        if (!physioId && !patientId) {
            return res.status(400).json({
                message: "Please provide either physioId or patientId",
                status: 400,
                success: false,
            });
        }


        if (physioId) {

            const CheckPhysio = await Physio.findById(physioId)

            if (!CheckPhysio) {
                return res.status(404).json({
                    message: "physio not exists ",
                    status: 404,
                    success: false
                });
            }

            query.physioId = physioId
            query.isRead = false,
                query.from = { $in: ['admin', 'patient'] }
            query.to = 'physio'
        }

        if (patientId) {
            const CheckPatient = await Patient.findById(patientId)

            if (!CheckPatient) {
                return res.status(404).json({
                    message: "patient not exists ",
                    status: 404,
                    success: false
                });
            }

            query.patientId = patientId
            query.isRead = false,
                query.from = { $in: ['admin', 'physio'] }
            query.to = 'patient'
        }

        const UnreadNotificationCount = await notification.find(query).countDocuments()

        if (UnreadNotificationCount) {
            return res.status(200).json({
                message: "success",
                status: 200,
                UnreadNotificationCount: UnreadNotificationCount,
                success: true,
            });

        }
        else {

            return res.status(400).json({
                message: "No unread Notifications are found Of this Id",
                status: 400,
                success: false
            });
        }

    } catch (error) {

        return res.status(500).json({
            message: "Internal Server Error",
            status: 500,
            success: false
        });
    }
}


/**
 * @route GET  api/UnreadChatsCount
 * @description  getCount of unreadChatscount Patinet or Physio
 * @access public
 * @param {string}  ID - req.query.physioId or req.query.physioId
 * @returns {object} Json response with suceess or error and the fetched invoice.
 * @throws {Error} if the patient id  or physioid id  is not exixsts
 */

UnreadChatsCount = async (req, res) => {

    try {
        const { physioId, patientId } = req.query
        let name = [];
        let id = {};

        if (!physioId && !patientId) {
            return res.status(400).json({
                message: "Please provide either physioId or patientId",
                status: 400,
                success: false,
            });
        }



        if (physioId) {
            const CheckPhysio = await Physio.findById(physioId)

            if (!CheckPhysio) {
                return res.status(404).json({
                    message: "physio not exists ",
                    status: 404,
                    success: false
                });
            }

            name = ["patient", "admin"]
            id.physioId = new mongoose.Types.ObjectId(physioId)

        }

        if (patientId) {
            const CheckPatient = await Patient.findById(patientId)

            if (!CheckPatient) {
                return res.status(404).json({
                    message: "patient not exists ",
                    status: 404,
                    success: false
                });
            }

            name = ["physio", "admin"]
            id.patientId = new mongoose.Types.ObjectId(patientId)

        }

        let unread = await ReturnUnreadChatCount(id, name)



        return res.status(200).json({
            message: "sucess",
            status: 200,
            success: true,
            ChatCount: unread
        });



    } catch (error) {

        return res.status(500).json({
            message: "Internal Server Error" + error,
            status: 500,
            success: false
        });
    }


}


// Convert string to array (if not already) 
// and remove falsy values (empty strings, null, undefined, etc.) 
// and return [] if input is null or undefined
toArray = (input, parseJson = false) => {
    if (!input) return [];
    if (parseJson) {
        input = JSON.parse(input);
    }
    if (Array.isArray(input)) return input.filter(Boolean);
    return input.split(',').map(item => item.trim()).filter(Boolean);
}


async function ReturnUnreadChatCount(id, name) {

    const result = await chat.aggregate([
        { $match: id },
        {
            $lookup: {
                from: 'patients',
                localField: 'patientId',
                foreignField: '_id',
                as: 'patientInfo'
            }
        },
        {
            $lookup: {
                from: 'physios',
                localField: 'physioId',
                foreignField: '_id',
                as: 'physioInfo'
            }
        },
        {
            $match: {
                'patientInfo.0': { $exists: true },
                'physioInfo.0': { $exists: true },
                'patientInfo.0.isDeleted': { $ne: true },
                'physioInfo.0.isDeleted': { $ne: true }
            }
        },
        { $unwind: '$messages' },
        {
            $match: {
                'messages.sender': { $in: name },
                'messages.isRead': false
            }
        },
        {
            $count: 'unreadCount'
        }
    ]);

    return result.length > 0 ? result[0].unreadCount : 0;
};

module.exports = {
    ReturnUnreadChatCount,
    toArray,
    UnreadChatsCount,
    UnreadNotificationCount

}