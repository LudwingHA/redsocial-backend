// controllers/notificationService.js
import Notification from "../models/Notification.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

export const notificationService = {
  // Crear notificación base con dedupe (5 min) y populate sender
  createNotification: async (data) => {
    try {
      // Dedupe: si existe una notificación exactamente igual en los últimos X minutos, la retornamos
      const DUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutos
      const dupQuery = {
        recipient: data.recipient,
        sender: data.sender,
        type: data.type,
        ...(data.post ? { post: data.post } : {}),
        createdAt: { $gte: new Date(Date.now() - DUP_WINDOW_MS) },
      };

      const duplicate = await Notification.findOne(dupQuery);
      if (duplicate) {
        // Si la notificación es del tipo like_post, podemos agrupar usuarios en metadata
        if (data.type === "like_post") {
          // push sender id to metadata.users y aumentar contador
          await Notification.findByIdAndUpdate(duplicate._id, {
            $addToSet: { "metadata.users": data.sender },
            $inc: { "metadata.count": 1 },
            $set: {
              updatedAt: new Date(),
              // actualizar comment si quieres un texto dinámico
            },
          });
          return await Notification.findById(duplicate._id).populate("sender", "username avatar");
        }
        // para otras notificaciones, retornamos la duplicada
        return duplicate.populate("sender", "username avatar");
      }

      // Crear nueva notificación (enriquecemos metadata según tipo)
      const notif = new Notification(data);
      // Si data.type == like_post, inicializar metadata.users y count
      if (data.type === "like_post") {
        notif.metadata = notif.metadata || {};
        notif.metadata.users = notif.metadata.users || [data.sender];
        notif.metadata.count = notif.metadata.count || 1;
      }

      await notif.save();
      await notif.populate("sender", "username avatar");
      return notif;
    } catch (error) {
      console.error("❌ Error creando notificación:", error);
      throw error;
    }
  },

  // Like notification con agrupación
  createLikeNotification: async (postId, likerId, postAuthorId) => {
    if (likerId.toString() === postAuthorId.toString()) return null;
    // obtener info del post para metadata
    const post = await Post.findById(postId).select("title thumbnail");
    return await notificationService.createNotification({
      recipient: postAuthorId,
      sender: likerId,
      type: "like_post",
      post: postId,
      metadata: {
        postId,
        postTitle: post?.title,
        postThumbnail: post?.thumbnail,
        users: [likerId],
        count: 1,
      },
    });
  },

  createCommentNotification: async (postId, commenterId, postAuthorId, commentContent) => {
    if (commenterId.toString() === postAuthorId.toString()) return null;
    const post = await Post.findById(postId).select("title thumbnail");
    return await notificationService.createNotification({
      recipient: postAuthorId,
      sender: commenterId,
      type: "comment_post",
      post: postId,
      comment: commentContent.substring(0, 200),
      metadata: {
        postId,
        postTitle: post?.title,
        postThumbnail: post?.thumbnail,
        comment: commentContent,
      },
    });
  },

  createMessageNotification: async (chatId, senderId, receiverId, messagePreview) => {
    if (senderId.toString() === receiverId.toString()) return null;
    return await notificationService.createNotification({
      recipient: receiverId,
      sender: senderId,
      type: "new_message",
      metadata: {
        chatId,
        messagePreview: messagePreview?.substring(0, 80),
      },
    });
  },

  createFollowNotification: async (followerId, followedId) => {
    if (followerId.toString() === followedId.toString()) return null;
    return await notificationService.createNotification({
      recipient: followedId,
      sender: followerId,
      type: "new_follower",
      metadata: { followerId },
    });
  },

  createStoryNotification: async (storyId, authorId, followerId) => {
    if (authorId.toString() === followerId.toString()) return null;
    return await notificationService.createNotification({
      recipient: followerId,
      sender: authorId,
      type: "story_uploaded",
      metadata: { storyId },
    });
  },

  createStoryLikeNotification: async (storyId, likerId, storyAuthorId) => {
    if (likerId.toString() === storyAuthorId.toString()) return null;
    return await notificationService.createNotification({
      recipient: storyAuthorId,
      sender: likerId,
      type: "story_liked",
      metadata: { storyId },
    });
  },

  // Obtener notificaciones (pag)
  getUserNotifications: async (userId, page = 1, limit = 20) => {
    try {
      const skip = (page - 1) * limit;
      const notifications = await Notification.find({ recipient: userId })
        .populate("sender", "username avatar")
        .populate("post")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments({ recipient: userId });
      const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });

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

  markAsRead: async (notificationIds, userId) => {
    try {
      if (!notificationIds || notificationIds.length === 0) {
        const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });
        return { success: true, unreadCount };
      }
      await Notification.updateMany({ _id: { $in: notificationIds }, recipient: userId }, { isRead: true });
      const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });
      return { success: true, unreadCount };
    } catch (error) {
      console.error("❌ Error marcando como leído:", error);
      throw error;
    }
  },

  markAllAsRead: async (userId) => {
    try {
      await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
      return { success: true };
    } catch (error) {
      console.error("❌ Error marcando todas como leídas:", error);
      throw error;
    }
  },

  deleteNotification: async (notificationId, userId) => {
    try {
      const result = await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
      return { success: !!result };
    } catch (error) {
      console.error("❌ Error eliminando notificación:", error);
      throw error;
    }
  },

  getUnreadCount: async (userId) => {
    try {
      return await Notification.countDocuments({ recipient: userId, isRead: false });
    } catch (error) {
      console.error("❌ Error obteniendo count de no leídas:", error);
      return 0;
    }
  },
};
