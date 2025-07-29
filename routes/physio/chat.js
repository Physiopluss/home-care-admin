const router = require('express').Router();
const chatController = require('../../controllers/physio/chatController');

const {
    LoggedIn
} = require('../../middleware/physioAuth')

router.post('/create-chat-room', chatController.createChatRoom);
router.post('/get-chat-room', chatController.getChatRoom);
router.get('/get-chat-physio-by-patient', chatController.getChatPhysioByPatients);
router.get('/get-chat-room', chatController.getChatPhysioByPatient);
router.post('/block-chat', chatController.blockChat);



module.exports = router