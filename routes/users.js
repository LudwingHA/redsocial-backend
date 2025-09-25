import express from 'express';
import userController from '../controllers/userController.js';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import { notificationService } from '../controllers/notificationService.js';

const router = express.Router();

// Rutas de usuario
router.get('/me', auth, userController.getCurrentUser);
router.get('/all', auth, userController.getAllUsers);
router.get('/search', auth, userController.searchUsers);
router.get('/:userId', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.put('/avatar', auth, userController.updateAvatar);

// Seguir a un usuario
router.post("/:id/follow", auth, async (req, res) => {
  try {
    const currentUserId = req.user.id; 
    const targetId = req.params.id; 

    if (currentUserId === targetId)
      return res.status(400).json({ message: "No puedes seguirte a ti mismo" });

    const user = await User.findById(currentUserId);
    const target = await User.findById(targetId);

    if (!user || !target) return res.status(404).json({ message: "Usuario no encontrado" });

    if (!target.followers.includes(currentUserId)) {
      target.followers.push(currentUserId);
      user.following.push(targetId);

      await target.save();
      await user.save();

      // 🔔 Crear notificación de nuevo seguidor
      const notification = await notificationService.createFollowNotification(currentUserId, targetId);
      
      // Emitir por socket
      const io = req.app.get("io");
      if (notification && io) {
        io.to(targetId.toString()).emit("newNotification", notification);

        // Actualizar contador de no leídas
        const unreadCount = await notificationService.getUnreadCount(targetId);
        io.to(targetId.toString()).emit("unreadCountUpdated", { unreadCount });
      }

      return res.status(200).json({ message: "Siguiendo al usuario", following: user.following });
    } else {
      return res.status(400).json({ message: "Ya sigues a este usuario" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Dejar de seguir a un usuario
router.post("/:id/unfollow", auth, async (req, res) => {
  try {
    const currentUserId = req.user.id; 
    const targetId = req.params.id; 

    if (currentUserId === targetId)
      return res.status(400).json({ message: "No puedes dejar de seguirte a ti mismo" });

    const user = await User.findById(currentUserId);
    const target = await User.findById(targetId);

    if (!user || !target) return res.status(404).json({ message: "Usuario no encontrado" });

    user.following = user.following.filter(id => id.toString() !== targetId);
    target.followers = target.followers.filter(id => id.toString() !== currentUserId);

    await user.save();
    await target.save();

    return res.status(200).json({ message: "Has dejado de seguir al usuario", following: user.following });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Obtener seguidores
router.get("/:id/followers", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("followers", "username avatar");
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    res.status(200).json(user.followers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Obtener siguiendo
router.get("/:id/following", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("following", "username avatar");
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    res.status(200).json(user.following);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;
