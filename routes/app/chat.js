const router = require('express').Router();
const chatController = require('../../controllers/app/chatController');
const verifyToken = require('../../middleware/auth');


router.post('/create/chat', chatController.createChatRoom)
router.post('/get/chat', chatController.getChatRoom)
router.get('/get/chat/patient', chatController.getChatePatientByPhysio)
router.get('/get/chat/room', chatController.getChatByPhysio)

module.exports = router;

