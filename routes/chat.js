// routes/chat.js
import express from 'express';
import chatController from '../controllers/chatController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, chatController.getUserChats);
router.post('/', auth, chatController.createChat);
router.get('/:chatId', auth, chatController.getChatMessages);
router.post('/:chatId/message', auth, chatController.sendMessage);
router.delete('/:chatId', auth, chatController.deleteChat);

export default router;