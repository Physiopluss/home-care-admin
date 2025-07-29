const notification = require('../models/notification');
const moment = require('moment')



async function adminNotificationCounter() {
    try {

        const startOfDay = moment().startOf('day').toDate();
        const adminNotifications = await notification.find({
            createdAt: { $gte: startOfDay }
        }).countDocuments()
        if (adminNotifications) {
            return adminNotifications
        }
        else {
            return 0
        }
    } catch (error) {

        console.log(`Error ${error}`);
        return 0

    }

}



module.exports = { adminNotificationCounter };
