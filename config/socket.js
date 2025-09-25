import { Server } from "socket.io";
import Chat from "../models/Chat.js";
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

  let onlineUsers = []; // Array global de usuarios conectados
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.userId;
    const username = socket.user?.username;

    socket.join(userId); // sala personal
    console.log(`🔌 Usuario conectado: ${username} (${userId})`);

    // ➕ Agregar a onlineUsers si no estaba
    if (!onlineUsers.includes(userId)) {
      onlineUsers.push(userId);
    }

    // Emitir lista actualizada a todos
    io.emit("updateOnlineUsers", onlineUsers);

    // JOIN/LEAVE CHAT
    socket.on("joinChat", (chatId) => socket.join(chatId));
    socket.on("leaveChat", (chatId) => socket.leave(chatId));

    // TYPING
    socket.on("typing", ({ chatId }) =>
      socket.to(chatId).emit("typing", { chatId, userId })
    );
    socket.on("stopTyping", ({ chatId }) =>
      socket.to(chatId).emit("stopTyping", { chatId, userId })
    );

    // SEND MESSAGE
    socket.on("sendMessage", async ({ chatId, content, tempId }) => {
      if (!content?.trim()) return;
      try {
        const chat = await Chat.findById(chatId).populate(
          "participants",
          "username avatar"
        );
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

        // Populamos sender
        await chat.populate({
          path: "messages.sender",
          select: "username avatar",
        });
        const savedMessage = chat.messages[chat.messages.length - 1];

        io.to(chatId).emit("newMessage", {
          chatId,
          message: savedMessage,
          tempId,
        });

        // Notificación al receptor
        const receiver = chat.participants.find(
          (p) => p._id.toString() !== userId
        );
        if (receiver) {
          const notification =
            await notificationService.createMessageNotification(
              chatId,
              userId,
              receiver._id,
              content.trim()
            );
          if (notification)
            io.to(receiver._id.toString()).emit(
              "newNotification",
              notification
            );
        }
      } catch (err) {
        console.error("Error enviando mensaje:", err);
      }
    });
    socket.on(
      "newComment",
      async ({ postId, commenterId, commentContent, postAuthorId }) => {
        if (!postAuthorId || postAuthorId === commenterId) return; // No notificamos al propio usuario
        try {
          const notification =
            await notificationService.createCommentNotification(
              postId,
              commenterId,
              postAuthorId,
              commentContent
            );
          if (notification) {
            io.to(postAuthorId).emit("newNotification", notification);

            // Actualizar contador de no leídas
            const unreadCount = await notificationService.getUnreadCount(
              postAuthorId
            );
            io.to(postAuthorId).emit("unreadCountUpdated", { unreadCount });
          }
        } catch (err) {
          console.error("Error creando notificación de comentario:", err);
        }
      }
    );

    // NOTIFICACIONES DE LIKES
    socket.on("postLiked", async ({ postId, likerId, postAuthorId }) => {
      if (!postAuthorId || postAuthorId === likerId) return; // No notificamos al propio usuario
      try {
        const notification = await notificationService.createLikeNotification(
          postId,
          likerId,
          postAuthorId
        );
        if (notification) {
          io.to(postAuthorId).emit("newNotification", notification);

          // Actualizar contador de no leídas
          const unreadCount = await notificationService.getUnreadCount(
            postAuthorId
          );
          io.to(postAuthorId).emit("unreadCountUpdated", { unreadCount });
        }
      } catch (err) {
        console.error("Error creando notificación de like:", err);
      }
    });
    // EVENTO: NUEVO SEGUIDOR
    socket.on("newFollower", async ({ followerId, followedId }) => {
      if (!followerId || !followedId) return;
      try {
        const notification = await notificationService.createFollowNotification(
          followerId,
          followedId
        );
        if (notification) {
          io.to(followedId).emit("newNotification", notification);

          const unreadCount = await notificationService.getUnreadCount(
            followedId
          );
          io.to(followedId).emit("unreadCountUpdated", { unreadCount });
        }
      } catch (err) {
        console.error("Error creando notificación de nuevo seguidor:", err);
      }
    });

    // NOTIFICATIONS
    socket.on("markNotificationsRead", async (ids) => {
      try {
        const result = await notificationService.markAsRead(ids, userId);
        socket.emit("unreadCountUpdated", { unreadCount: result.unreadCount });
      } catch (err) {
        socket.emit("notificationError", {
          error: "Error marcando notificaciones",
        });
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      console.log(`🔌 Usuario desconectado: ${username} (${userId})`);

      // ➖ Quitar de onlineUsers
      onlineUsers = onlineUsers.filter((id) => id !== userId);

      // Emitir lista actualizada a todos
      io.emit("updateOnlineUsers", onlineUsers);
    });
  });

  return io;
};
