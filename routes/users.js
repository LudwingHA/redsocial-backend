// routes/users.js
import express from 'express';
import userController from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/me', auth, userController.getCurrentUser);
router.get('/search', auth, userController.searchUsers);
router.get('/:userId', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.put('/avatar', auth, userController.updateAvatar);
router.post('/:userId/follow', auth, userController.toggleFollow);

export default router;