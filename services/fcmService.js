const admin = require('../config/firebase');
const Notification = require('../models/notification');


const sendFCMNotification = async (tokens, data, saveOnly = false) => {



    if (!data.title || !data.body) {
        console.error('Missing title and body in notification data:', data);
        return { success: false, error: 'Invalid notification data' };
    }

    tokens = Array.isArray(tokens) ? tokens : [tokens];

    const message = {
        tokens: tokens,
        notification: {
            title: data.title ,
            body: data.body 
        }
        // data: fcmData
    };

    try {
        let response = null;
        if (!saveOnly) response = await admin.messaging().sendEachForMulticast(message);
        await Notification.create({
            physioId: data.physioId || null,
            patientId: data.patientId || null,
            title: data.title,
            message: data.body,
            type: data.type,
            from: data.from,
            to: data.to,
            for: data.for || null,
        });

        return { success: true, response };
    } catch (err) {
        console.error('FCM Send Error:', err);
        return { success: false, error: err.message };
    }
};

module.exports = { sendFCMNotification };
