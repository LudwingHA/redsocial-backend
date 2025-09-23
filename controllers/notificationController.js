import Notification from '../models/Notification.js';
import { notificationService } from "./notificationService.js";

export const notificationController = {
  // Obtener notificaciones del usuario
  getUserNotifications: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await notificationService.getUserNotifications(
        req.user.id, 
        page, 
        limit
      );

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Marcar notificaciones como leídas
  markAsRead: async (req, res) => {
    try {
      const { notificationIds } = req.body;
      
      const result = await notificationService.markAsRead(
        notificationIds || [], 
        req.user.id
      );

      // Emitir evento de socket para actualizar en tiempo real
      const io = req.app.get("io");
      if (io) {
        io.to(req.user.id.toString()).emit("unreadCountUpdated", { 
          unreadCount: result.unreadCount 
        });
      }

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Marcar todas como leídas
  markAllAsRead: async (req, res) => {
    try {
      const result = await notificationService.markAllAsRead(req.user.id);

      // Emitir evento de socket
      const io = req.app.get("io");
      if (io) {
        io.to(req.user.id.toString()).emit("unreadCountUpdated", { 
          unreadCount: 0 
        });
      }

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Eliminar notificación
  deleteNotification: async (req, res) => {
    try {
      const result = await notificationService.deleteNotification(
        req.params.id, 
        req.user.id
      );

      res.json({ success: result.success });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Contador de no leídas
  getUnreadCount: async (req, res) => {
    try {
      const unreadCount = await Notification.countDocuments({ 
        recipient: req.user.id, 
        isRead: false 
      });

      res.json({ success: true, unreadCount });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export default notificationController;