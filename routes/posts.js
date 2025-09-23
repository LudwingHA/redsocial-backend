import express from 'express';
import postController from '../controllers/postController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Rutas de posts
router.get('/', auth, postController.getPosts);
router.get('/search', auth, postController.searchPosts);
router.get('/user/:userId', auth, postController.getUserPosts);
router.get('/:postId', auth, postController.getPost);
router.post('/', auth, postController.createPost);
router.put('/:postId', auth, postController.updatePost);
router.delete('/:postId', auth, postController.deletePost);

// Interacciones con posts
router.post('/:postId/like', auth, postController.toggleLike);
router.post('/:postId/comment', auth, postController.addComment);
router.delete('/:postId/comment/:commentId', auth, postController.deleteComment);

export default router;