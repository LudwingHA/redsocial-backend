import express from 'express';
import notificationController from '../controllers/notificationController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, notificationController.getUserNotifications);
router.patch('/read', auth, notificationController.markAsRead);
router.patch('/read-all', auth, notificationController.markAllAsRead);
router.delete('/:id', auth, notificationController.deleteNotification);
router.get('/unread-count', auth, notificationController.getUnreadCount);

export default router;  