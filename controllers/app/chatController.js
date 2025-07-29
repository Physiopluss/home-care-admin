const Chat = require('../../models/chatroom'); // Path to your Chat model
const Physio = require('../../models/physio');
const Patient = require('../../models/patient');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
// const AWS = require('aws-sdk');
const moment = require('moment');
const mongoose = require('mongoose');
const { sendFCMNotification } = require('../../services/fcmService');
const notification = require('../../models/notification');
const { ReturnUnreadChatCount } = require('../../utility/helper');
const { uploadFileToS3 } = require('../../services/awsService');


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/blog');
        fs.mkdirSync(uploadPath, {
            recursive: true
        });
        cb(null, uploadPath);
    },
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
        }).populate('physioId patientId');

        // If no chat exists, create a new one
        if (chats.length === 0) {
            const chat = new Chat({
                physioId,
                patientId
            });
            await chat.save();

            const physio = await Physio.findById(physioId);

            return res.status(200).json({
                message: 'Chat created',
                success: true,
                status: 200,
                data: chat,
                physio,
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

            if (!roomId) return res.status(400).json({
                message: 'RoomId is required',
                success: false,
                status: 400
            });

            if (!sender) return res.status(400).json({
                message: 'Sender is required',
                success: false,
                status: 400
            });

            const chat = await Chat.findOne({ _id: roomId });
            if (!chat) return res.status(400).json({
                message: 'Chat not found',
                success: false,
                status: 400
            });

            const physio = await Physio.findById(chat.physioId);
            if (!physio) return res.status(400).json({
                message: 'Physio not found',
                success: false,
                status: 400
            });

            const patient = await Patient.findById(chat.patientId);
            if (!patient) return res.status(400).json({
                message: 'Patient not found',
                success: false,
                status: 400
            });

            // Function to send notifications 
            const sendNotificationss = async (receiverId, notificationMessage, patientId) => {
                try {
                    const receiver = await Patient.findById(receiverId); // Replace with appropriate User/Physio model
                    if (receiver && receiver.deviceId) {
                        const data = {
                            title: receiver.fullName,
                            body: `You got new message from ${receiver.fullName || 'Patient'}`,
                            physioId: physio._id.toString(),
                            type: 'other',
                            from: 'patient',
                            to: 'physio',
                            for: 'physio'
                        }

                        let id = {}
                        id.physioId = physio._id
                        const name = ['patient', 'Admin']

                        // this is for finding how  many chats are unread if  threshold match then notification is send 
                        let unreadCount = await ReturnUnreadChatCount(id, name)
                        if ([5, 10, 15].includes(unreadCount)) {
                            const result = await sendFCMNotification(physio.deviceId, data)

                            if (!result.success) {

                                await notification.create({
                                    physioId: physio._id || null,
                                    title: data.title,
                                    message: data.body,
                                    type: data.type,
                                    from: data.from,
                                    to: data.to,
                                    for: data.for,
                                });

                                console.log("Error sending notification to physio", result);
                            } else {
                                console.log("FCM sent successfully");
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error sending ${physio} notification:`, error.message);
                }
            };

            if (req.file) {
                const uploadResponse = await uploadFileToS3(req.file, 'chat');

                const newChat = await Chat.findOneAndUpdate(
                    { _id: chat._id },
                    {
                        $push: {
                            messages: {
                                message: message,
                                sender: sender,
                                attachment: uploadResponse.url
                            },
                            $set: {
                                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS')
                            }

                        }
                    },
                    { new: true }
                );

                // Send notification to the physio
                await sendNotificationss(chat.patientId, message + uploadResponse.url, newChat.patientId);

                res.status(200).json({
                    message: 'Chat updated',
                    success: true,
                    status: 200,
                    data: newChat
                });

            } else {
                const newChat = await Chat.findOneAndUpdate(
                    { _id: chat._id },
                    {
                        $push: {
                            messages: {
                                message: message,
                                sender: sender
                            },
                            $set: {
                                updatedAt: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS')
                            }
                        }
                    },
                    { new: true }
                );

                // Send notification to the physio
                await sendNotificationss(chat.patientId, message, newChat.patientId);

                res.status(200).json({
                    message: 'Chat updated',
                    success: true,
                    status: 200,
                    data: newChat
                });
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Something went wrong',
            status: 500,
            success: false
        });
    }
};

exports.getChatePatientByPhysio = async (req, res) => {
    try {
        let { patientId, searchByName } = req.query;
        if (!patientId && !req.query.patientId) return res.status(400).json({
            message: 'PatientId is required',
            success: false,
            status: 400
        });

        // if check patientId exists
        const patient = await Patient.findById(patientId);
        if (!patient) return res.status(400).json({
            message: 'Patient not found',
            success: false,
            status: 400
        });


        const matchCondition = searchByName ? { fullName: { $regex: searchByName.trim(), $options: "i" } } : {}
        const chat = await Chat.find({ patientId }).populate({
            path: "physioId",
            match: matchCondition,
            populate: {
                path: 'specialization',
                model: 'Specialization',
                select: 'name'

            }// Ensuring a proper regex
        }).populate("patientId")
            .sort({ updatedAt: -1 });

        const filterchat = chat.filter(item => item.physioId != null)

        // const chat = await Chat.find({ patientId: patientId })
        //     .populate({
        //         path: 'physioId',
        //         populate: {
        //             path: 'specialization',
        //             model: 'Specialization',
        //             select: 'name'
        //         }
        //     }).populate('patientId').sort({ updatedAt: -1 });

        if (!chat) return res.status(400).json({
            message: 'Chat not found',
            success: false,
            status: 400
        });

        res.status(200).json({
            message: 'Chat fetched',
            success: true,
            status: 200,

            data: filterchat
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false
        });
    }
}
// get chatId with physioId
// exports.getChatByPhysio = async (req, res) => {
//     try {
//         let { roomId } = req.query;

//         if (!roomId) return res.status(400).json({
//             message: 'RoomId is required',
//             success: false,
//             status: 400
//         });

//         // if check roomId exists
//         const chat = await Chat.findById(roomId);
//         if (!chat) return res.status(400).json({
//             message: 'Chat not found',
//             success: false,
//             status: 400
//         });

//         res.status(200).json({
//             message: 'Chat fetched',
//             success: true,
//             status: 200,
//             data: chat
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             message: "Something went wrong",
//             status: 500,
//             success: false
//         });
//     }
// }

exports.getChatByPhysio = async (req, res) => {
    try {
        let { roomId } = req.query;
        if (!roomId) {
            return res.status(400).json({
                message: 'RoomId is required',
                success: false,
                status: 400
            });
        }

        // Check if the chat exists
        const chat = await Chat.findOne({ _id: roomId });
        if (!chat) {
            return res.status(400).json({
                message: 'Chat not found',
                success: false,
                status: 400
            });
        }

        // Update `isRead` for messages using aggregate pipeline
        await Chat.updateOne(
            { _id: roomId },
            { $set: { 'messages.$[elem].isRead': true } },
            {
                arrayFilters: [{ 'elem.sender': { $in: ['physio', 'admin'] } }]
            }
        );


        // Fetch updated chat details
        const updatedChat = await Chat.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(roomId) } }, // Correct ObjectId usage
            {
                $project: {
                    messages: 1,
                    physioId: 1,
                    patientId: 1,
                    blocked: 1
                }
            }
        ]);

        return res.status(200).json({
            message: 'Chat retrieved successfully',
            success: true,
            status: 200,
            data: updatedChat
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong",
            status: 500,
            success: false,
        });
    }
};

exports.sendChatMessage = async (physioId, patientId, message) => {
    try {
        if (!physioId || !patientId || !message) {
            return {
                message: 'physioId, patientId and message are required',
                success: false,
                status: 400
            };
        }

        // Validate physioId and patientId are valid ObjectIds
        if (!mongoose.Types.ObjectId.isValid(physioId) || !mongoose.Types.ObjectId.isValid(patientId)) {
            return {
                message: 'Invalid physioId or patientId format',
                success: false,
                status: 400
            };
        }

        // Check if physio and patient exist
        const [physio, patient] = await Promise.all([
            Physio.findById(physioId),
            Patient.findById(patientId)
        ]);

        if (!physio || !patient) {
            return {
                message: 'Physio or Patient not found',
                success: false,
                status: 404
            };
        }

        // Find or create chat room
        let chatroom = await Chat.findOne({
            physioId,
            patientId
        });

        if (!chatroom) {
            chatroom = new Chat({
                physioId,
                patientId,
                messages: []
            });
        }

        // Add new message
        const newMessage = {
            sender: 'admin',
            message: message,
            timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'),
            isRead: false
        };

        chatroom.messages.push(newMessage);
        chatroom.updatedAt = newMessage.timestamp;
        await chatroom.save();

        // Send notification to patient if they have a deviceId
        if (patient.deviceId) {
            try {
                const data = {
                    title: 'Invoice',
                    body: 'invoice generated',
                    patientId: patient._id.toString(),
                    type: 'other',
                    from: 'admin',
                    to: 'patient',
                    for: 'patient'
                }

                const result = await sendFCMNotification(patient.deviceId, data)

                if (!result.success) {
                    console.log("Error sending notification to patient", result);
                }
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
            }
        }
        if (physio.deviceId) {
            try {
                const data = {
                    title: 'Invoice',
                    body: 'invoice generated',
                    physioId: physio._id.toString(),
                    type: 'other',
                    from: 'admin',
                    to: 'physio',
                    for: 'physio'
                }

                const result = await sendFCMNotification(physio.deviceId, data)

                if (!result.success) {
                    console.log("Error sending notification to physio", result);
                }
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
            }
        }


        return JSON.stringify({
            message: 'Message sent successfully',
            success: true,
            status: 200,
            data: {
                chatroom,
                newMessage
            }
        });

    } catch (error) {
        console.error('Error in sendChatMessage:', error);
        return JSON.stringify({
            message: 'Something went wrong',
            success: false,
            status: 500,
            error: error.message
        });
    }
};


