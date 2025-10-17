import Notification from "../models/Notification.js";

export const notificationService = {
  // Crear notificación
  createNotification: async (data) => {
    try {
      console.log("Creando notificación:", data);

      // Evitar notificaciones duplicadas recientes (5 min)
      const duplicate = await Notification.findOne({
        recipient: data.recipient,
        sender: data.sender,
        type: data.type,
        post: data.post,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutos
      });

      if (duplicate) {
        console.log("Notificación duplicada encontrada, omitiendo");
        return duplicate;
      }

      const notification = new Notification(data);
      await notification.save();
      await notification.populate("sender", "username avatar");

      console.log("Notificación creada exitosamente");
      return notification;
    } catch (error) {
      console.error("❌ Error creando notificación:", error);
      throw error;
    }
  },

  // Notificación para like de post
  createLikeNotification: async (postId, likerId, postAuthorId) => {
    if (likerId.toString() === postAuthorId.toString()) {
      console.log("🔔 Like propio, no se crea notificación");
      return null;
    }

    return await notificationService.createNotification({
      recipient: postAuthorId,
      sender: likerId,
      type: "like_post",
      post: postId,
      metadata: { postId },
    });
  },

  // Notificación para comentario de post
  createCommentNotification: async (
    postId,
    commenterId,
    postAuthorId,
    commentContent
  ) => {
    if (commenterId.toString() === postAuthorId.toString()) {
      console.log("🔔 Comentario propio, no se crea notificación");
      return null;
    }

    return await notificationService.createNotification({
      recipient: postAuthorId,
      sender: commenterId,
      type: "comment_post",
      post: postId,
      comment: commentContent.substring(0, 100),
      metadata: { postId, comment: commentContent },
    });
  },

  // Notificación para mensaje
  createMessageNotification: async (
    chatId,
    senderId,
    receiverId,
    messagePreview
  ) => {
    return await notificationService.createNotification({
      recipient: receiverId,
      sender: senderId,
      type: "new_message",
      metadata: {
        chatId,
        messagePreview: messagePreview.substring(0, 50),
      },
    });
  },

  // --- NUEVA FUNCIÓN: Notificación de nuevo seguidor ---
  createFollowNotification: async (followerId, followedId) => {
    if (followerId.toString() === followedId.toString()) {
      console.log("🔔 No se puede seguir a uno mismo, no se crea notificación");
      return null;
    }

    return await notificationService.createNotification({
      recipient: followedId,
      sender: followerId,
      type: "new_follower",
      metadata: { followerId },
    });
  },

  // Obtener notificaciones del usuario
  getUserNotifications: async (userId, page = 1, limit = 20) => {
    try {
      const skip = (page - 1) * limit;

      const notifications = await Notification.find({ recipient: userId })
        .populate("sender", "username avatar")
        .populate("post")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments({ recipient: userId });
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
      });

      return {
        notifications,
        total,
        unreadCount,
        hasMore: total > skip + limit,
      };
    } catch (error) {
      console.error("❌ Error obteniendo notificaciones:", error);
      throw error;
    }
  },

  // Marcar como leídas
  markAsRead: async (notificationIds, userId) => {
    try {
      await Notification.updateMany(
        { _id: { $in: notificationIds }, recipient: userId },
        { isRead: true }
      );

      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
      });
      return { success: true, unreadCount };
    } catch (error) {
      console.error("❌ Error marcando como leído:", error);
      throw error;
    }
  },

  // Marcar todas como leídas
  markAllAsRead: async (userId) => {
    try {
      await Notification.updateMany(
        { recipient: userId, isRead: false },
        { isRead: true }
      );
      return { success: true };
    } catch (error) {
      console.error("❌ Error marcando todas como leídas:", error);
      throw error;
    }
  },

  // Eliminar notificación
  deleteNotification: async (notificationId, userId) => {
    try {
      const result = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId,
      });
      return { success: !!result };
    } catch (error) {
      console.error("❌ Error eliminando notificación:", error);
      throw error;
    }
  },
  // Agregar al final del export
  getUnreadCount: async (userId) => {
    try {
      return await Notification.countDocuments({
        recipient: userId,
        isRead: false,
      });
    } catch (error) {
      console.error("❌ Error obteniendo count de no leídas:", error);
      return 0;
    }
  },
};
