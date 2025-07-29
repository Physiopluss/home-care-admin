const router = require('express').Router();
const NotificationController = require('../../controllers/admin/notificationController');
const { adminNotificationCounter } = require('../../utility/socketIo');

router.get('/list', NotificationController.getNotifications);
router.post('/send', NotificationController.sendNotification);
router.get('/adminNotificationCounter', async (req, res) => {
    let counter = await adminNotificationCounter()
    return res.json({ 'counter': counter })
})


module.exports = router;
