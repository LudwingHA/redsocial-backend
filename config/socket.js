 import { Server } from "socket.io";
import Chat from "../models/Chat.js";
import Story from "../models/Story.js";
import { notificationService } from "../controllers/notificationService.js";
import { authenticateSocket } from "./socketAuth.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5174",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const onlineUsers = new Map(); // Map para evitar duplicados y asociar sockets por usuario

  io.use(authenticateSocket);

  io.on("connection", async (socket) => {
    try {
      const userId = socket.userId;
      const username = socket.user?.username;

      if (!userId) {
        socket.disconnect(true);
        return;
      }

      console.log(`✅ Usuario conectado: ${username} (${userId})`);
      onlineUsers.set(userId, socket.id);
      io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));

      socket.join(userId); // Sala personal

      // Enviar notificaciones pendientes
      const unread = await notificationService.getUserNotifications(userId, 1, 10);
      if (unread?.notifications?.length) {
        socket.emit("pendingNotifications", unread.notifications);
      }

      // 🗨️ CHAT
      socket.on("joinChat", (chatId) => socket.join(chatId));
      socket.on("leaveChat", (chatId) => socket.leave(chatId));

      socket.on("typing", ({ chatId }) =>
        socket.to(chatId).emit("typing", { chatId, userId })
      );

      socket.on("stopTyping", ({ chatId }) =>
        socket.to(chatId).emit("stopTyping", { chatId, userId })
      );

      // 💬 Enviar mensaje
      socket.on("sendMessage", async ({ chatId, content, tempId }) => {
        if (!content?.trim()) return;

        try {
          const chat = await Chat.findById(chatId).populate("participants", "username avatar");
          if (!chat) return;

          const newMessage = {
            sender: userId,
            content: content.trim(),
            timestamp: new Date(),
          };

          chat.messages.push(newMessage);
          chat.lastMessage = new Date();
          chat.lastMessageContent = content.trim();
          await chat.save();

          await chat.populate({ path: "messages.sender", select: "username avatar" });
          const savedMessage = chat.messages.at(-1);

          io.to(chatId).emit("newMessage", { chatId, message: savedMessage, tempId });

          // Notificar al receptor
          const receiver = chat.participants.find((p) => p._id.toString() !== userId);
          if (receiver) {
            const notification = await notificationService.createMessageNotification(
              chatId,
              userId,
              receiver._id,
              content.trim()
            );

            if (notification) {
              io.to(receiver._id.toString()).emit("newNotification", notification);
              const unreadCount = await notificationService.getUnreadCount(receiver._id);
              io.to(receiver._id.toString()).emit("unreadCountUpdated", { unreadCount });
            }
          }
        } catch (err) {
          console.error("❌ Error enviando mensaje:", err);
        }
      });

      // 💬 Comentarios
      socket.on("newComment", async ({ postId, commenterId, commentContent, postAuthorId }) => {
        if (!postAuthorId || postAuthorId === commenterId) return;
        try {
          const notification = await notificationService.createCommentNotification(
            postId,
            commenterId,
            postAuthorId,
            commentContent
          );
          if (notification) {
            io.to(postAuthorId).emit("newNotification", notification);
            const unreadCount = await notificationService.getUnreadCount(postAuthorId);
            io.to(postAuthorId).emit("unreadCountUpdated", { unreadCount });
          }
        } catch (err) {
          console.error("❌ Error creando notificación de comentario:", err);
        }
      });

      // ❤️ Likes
      socket.on("postLiked", async ({ postId, likerId, postAuthorId }) => {
        if (!postAuthorId || postAuthorId === likerId) return;
        try {
          const notification = await notificationService.createLikeNotification(
            postId,
            likerId,
            postAuthorId
          );
          if (notification) {
            io.to(postAuthorId).emit("newNotification", notification);
            const unreadCount = await notificationService.getUnreadCount(postAuthorId);
            io.to(postAuthorId).emit("unreadCountUpdated", { unreadCount });
          }
        } catch (err) {
          console.error("❌ Error creando notificación de like:", err);
        }
      });

      // 👥 Nuevo seguidor
      socket.on("newFollower", async ({ followerId, followedId }) => {
        if (!followerId || !followedId) return;
        try {
          const notification = await notificationService.createFollowNotification(
            followerId,
            followedId
          );
          if (notification) {
            io.to(followedId).emit("newNotification", notification);
            const unreadCount = await notificationService.getUnreadCount(followedId);
            io.to(followedId).emit("unreadCountUpdated", { unreadCount });
          }
        } catch (err) {
          console.error("❌ Error creando notificación de seguidor:", err);
        }
      });

      // 🔔 Marcar como leídas
      socket.on("markNotificationsRead", async (ids) => {
        try {
          const result = await notificationService.markAsRead(ids, userId);
          socket.emit("unreadCountUpdated", { unreadCount: result.unreadCount });
        } catch (err) {
          socket.emit("notificationError", {
            error: "Error al marcar notificaciones como leídas",
          });
        }
      });

      // 📸 Stories
      socket.on("newStory", async ({ storyId }) => {
        try {
          const story = await Story.findById(storyId).populate("author", "username avatar followers");
          if (!story) return;

          io.emit("storyAdded", story);

          const followers = story.author.followers || [];
          for (const followerId of followers) {
            const notification = await notificationService.createStoryNotification(
              storyId,
              story.author._id,
              followerId
            );
            if (notification) {
              io.to(followerId.toString()).emit("newNotification", notification);
            }
          }
        } catch (err) {
          console.error("❌ Error en newStory:", err);
        }
      });

      socket.on("viewStory", async ({ storyId, viewerId }) => {
        try {
          const story = await Story.findById(storyId);
          if (!story) return;
          if (!story.views.includes(viewerId)) {
            story.views.push(viewerId);
            await story.save();
            io.emit("storyViewed", { storyId, viewsCount: story.views.length });
          }
        } catch (err) {
          console.error("❌ Error en viewStory:", err);
        }
      });

      socket.on("likeStory", async ({ storyId, likerId }) => {
        try {
          const story = await Story.findById(storyId).populate("author");
          if (!story) return;

          const alreadyLiked = story.likes.includes(likerId);
          story.likes = alreadyLiked
            ? story.likes.filter((id) => id.toString() !== likerId)
            : [...story.likes, likerId];
          await story.save();

          io.emit("storyLiked", { storyId, likesCount: story.likes.length });

          if (story.author._id.toString() !== likerId) {
            const notification = await notificationService.createStoryLikeNotification(
              storyId,
              likerId,
              story.author._id
            );
            if (notification) {
              io.to(story.author._id.toString()).emit("newNotification", notification);
            }
          }
        } catch (err) {
          console.error("❌ Error en likeStory:", err);
        }
      });

      // ❌ Desconexión
      socket.on("disconnect", () => {
        console.log(`🔌 Usuario desconectado: ${username} (${userId})`);
        onlineUsers.delete(userId);
        io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
      });
    } catch (err) {
      console.error("🚨 Error general en socket:", err);
      socket.disconnect(true);
    }
  });

  return io;
};
