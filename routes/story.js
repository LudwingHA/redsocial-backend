import express from 'express'
import auth from '../middleware/auth.js';
import { storyUpload } from '../config/multer.js';
import { getStories, likeStory, uploadStory, viewStory } from '../controllers/storyController.js';
const router = express.Router();
router.post('/', auth, storyUpload.single("media"), uploadStory);
router.get('/', auth, getStories);
router.post('/:id/view', auth, viewStory);
router.post('/:id/like', auth, likeStory);
export default router