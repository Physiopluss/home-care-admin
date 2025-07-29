const Chat = require('../../models/chatroom'); // Path to your Chat model
const Physio = require('../../models/physio');
const Patient = require('../../models/patient');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
// const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const Notification = require('../../models/notification');
const mongoose = require('mongoose');
const { sendFCMNotification } = require('../../services/fcmService');
const { ReturnUnreadChatCount } = require('../../utility/helper');
const { uploadFileToS3 } = require('../../services/awsService');


// Set The Storage Engine
const storage = multer.diskStorage({
    filename(req, file, cb) {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    },
});

// AWS S3 bucket configuration
// const s3 = new AWS.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });

const upload = multer({
    storage: storage
}).single('attachment');

exports.createChatRoom = async (req, res) => {
    try {
        const {
            physioId,
            patientId
        } = req.body;

        if (!physioId) {
            return res.status(400).json({
                message: 'PhysioId is required',
                success: false,
                status: 400
            });
        }

        if (!patientId) {
            return res.status(400).json({
                message: 'PatientId is required',
                success: false,
                status: 400
            });
        }

        // Check if PhysioId and PatientId exist
        const physio = await Physio.findById(physioId);
        if (!physio) {
            return res.status(400).json({
                message: 'Physio not found',
                success: false,
                status: 400
            });
        }

        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(400).json({
                message: 'Patient not found',
                success: false,
                status: 400
            });
        }

        // Check if a chat already exists between the physio and the patient
        const chats = await Chat.find({
            physioId,
            patientId
        });

        // If no chat exists, create a new one
        if (chats.length === 0) {
            const chat = new Chat({
                physioId,
                patientId
            });

            await chat.save();

            return res.status(200).json({
                message: 'Chat created',
                success: true,
                status: 200,
                data: chat
            });
        } else {
            return res.status(400).json({
                message: 'Chat already exists',
                success: false,
                status: 400
            });
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Something went wrong',
            status: 500,
            success: false
        });
    }
};


// physioId chat with patientId 

exports.getChatRoom = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    message: 'Error uploading file',
                    success: false,
                    status: 400
                });
            }

            const { roomId, message, sender } = req.body;


            if (!roomId) {
                return res.status(400).json({
                    message: 'RoomId is required',
                    success: false,
                    status: 400
                });
            }

            if (!sender) {
                return res.status(400).json({
                    message: 'Sender is required',
                    success: false,
                    status: 400
                });
            }

            const chat = await Chat.findById(roomId);
            if (!chat) {
                return res.status(400).json({
                    message: 'Chat not found',
                    success: false,
                    status: 400
                });
            }

            const patient = await Patient.findById(chat.patientId);
            if (!patient) {
                return res.status(400).json({
                    message: 'Patient not found',
                    success: false,
                    status: 400
                });
            }

            //ReturnUnreadChatCount

            const sendNotificationss = async (receiverId, notificationMessage) => {
                try {
                    const receiver = await Physio.findById(receiverId);
                    if (!receiver) throw new Error("Receiver not found");

                    const data = {
                        title: receiver.fullName || 'Physio',
                        body: `You got new message from ${receiver.fullName || 'Physio'}`,
                        patientId: patient._id.toString(),
                        type: 'other',
                        from: 'physio',
                        to: 'patient',
                        for: 'patient'
                    };

                    if (patient.deviceId) {

                        let id = {}
                        id.patientId = patient._id
                        const name = ['physio', 'Admin']
                        let unreadCount = await ReturnUnreadChatCount(id, name)

                        if ([5, 10, 15].includes(unreadCount)) {

                            const result = await sendFCMNotification(patient.deviceId, data);

                            if (!result.success) {
                                console.log("FCM failed, saving notification to DB");

                                await Notification.create({
                                    patientId: data.patientId,
                                    title: data.title,
                                    message: data.body,
                                    type: data.type,
                                    from: data.from,
                                    to: data.to,
                                    for: data.for
                                });
                            } else {
                                console.log("FCM sent successfully");
                            }
                        }

                    } else {
                        console.log("No deviceId found. Skipping FCM and not saving to DB.");
                    }

                } catch (error) {
                    console.error("Notification Error:", error.message);
                }
            };

            if (req.file) {
                const uploadResult = await uploadFileToS3(req.file, 'chat');

                const updatedChat = await Chat.findByIdAndUpdate(chat._id, {
                    $push: {
                        messages: {
                            message,
                            sender: sender,
                            attachment: uploadResult.url
                        }
                    },
                    $set: {
                        updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS')
                    }
                }, { new: true });

                await sendNotificationss(chat.physioId, message);

                return res.status(200).json({
                    message: 'Chat updated with attachment',
                    success: true,
                    status: 200,
                    data: updatedChat
                });

            } else {
                const updatedChat = await Chat.findByIdAndUpdate(chat._id, {
                    $push: {
                        messages: {
                            message,
                            sender: sender,
                        }
                    },
                    $set: {
                        updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS')
                    }
                }, { new: true });

                await sendNotificationss(chat.physioId, message);

                return res.status(200).json({
                    message: 'Chat updated',
                    success: true,
                    status: 200,
                    data: updatedChat
                });
            }

        });
    } catch (error) {
        console.error("getChatRoom Error:", error);
        return res.status(500).json({
            message: "Something went wrong",
            success: false,
            status: 500
        });
    }
};

// physioId chat with patientId
exports.getChatPhysioByPatients = async (req, res) => {
    try {

        let { physioId, searchByName } = req.query;

        if (!physioId) return res.status(400).json({
            message: 'physioId is required',
            success: false,
            status: 400
        });

        // if chat physioId is not found
        const chatPhysio = await Physio.findById(physioId);
        if (!chatPhysio) return res.status(400).json({
            message: 'Physio not found',
            success: false,
            status: 400
        });
        const matchCondition = searchByName ? { fullName: { $regex: searchByName.trim(), $options: "i" } } : {}

        const chat = await Chat.find({ physioId }).populate({
            path: "physioId",
            match: matchCondition,
            populate: {
                path: 'specialization',
                model: 'Specialization',
                select: 'name'

            }// Ensuring a proper regex
        }).populate("patientId")
            .sort({ updatedAt: -1 });

        const chatFiter = chat.filter(item => item.patientId != null)

        if (!chat) return res.status(400).json({
            message: 'Chat not found',
            success: false,
            status: 400
        })

        res.status(200).json({
            message: 'Chat fetched',
            success: true,
            status: 200,
            data: chatFiter
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false,
        });
    }
}





exports.getChatPhysioByPatient = async (req, res) => {
    try {
        const { roomId } = req.query;

        if (!roomId) {
            return res.status(400).json({
                message: 'RoomId is required',
                success: false,
                status: 400
            });
        }

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({
                message: 'Invalid RoomId format',
                success: false,
                status: 400
            });
        }
        await Chat.updateOne(
            { _id: roomId },
            { $set: { 'messages.$[elem].isRead': true } },
            {
                arrayFilters: [
                    {
                        'elem.sender': { $in: ['patient', 'admin'] },
                        'elem.isRead': false
                    }
                ]
            }
        );


        const updatedChat = await Chat.findById(roomId, {
            messages: 1,
            physioId: 1,
            patientId: 1,
            blocked: 1
        });

        if (!updatedChat) {
            return res.status(404).json({
                message: 'Chat not found',
                success: false,
                status: 404
            });
        }

        return res.status(200).json({
            message: 'Chat retrieved successfully',
            success: true,
            status: 200,
            data: updatedChat
        });

    } catch (error) {
        console.error("Error in getChatPhysioByPatient:", error);
        return res.status(500).json({
            message: "Something went wrong",
            success: false,
            status: 500
        });
    }
};





// patientId chat is blocked by physioId
exports.blockChat = async (req, res) => {
    try {

        const {
            roomId,
            blocked
        } = req.body;
        if (!roomId) return res.status(400).json({
            message: 'RoomId is required',
            success: false,
            status: 400
        });

        const chat = await Chat.findOne({
            _id: roomId
        });

        if (!chat) return res.status(400).json({
            message: 'Chat not found',
            success: false,
            status: 400
        });

        // Add message to chat
        const newChat = await Chat.findOneAndUpdate({
            _id: chat._id
        }, {
            $set: {
                blocked: blocked
            }

        }, {
            new: true
        });

        res.status(200).json({
            message: 'Chat blocked',
            success: true,
            status: 200,
            data: newChat
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Semething went wrong",
            status: 500,
            success: false,
        });
    }
}