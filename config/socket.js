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

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.userId;
    const username = socket.user?.username;

    socket.join(userId);
    console.log(`🔌 Usuario conectado: ${username} (${userId})`);

    // JOIN/LEAVE CHAT
    socket.on("joinChat", (chatId) => socket.join(chatId));
    socket.on("leaveChat", (chatId) => socket.leave(chatId));

    // TYPING
    socket.on("typing", ({ chatId }) => socket.to(chatId).emit("typing", { chatId, userId }));
    socket.on("stopTyping", ({ chatId }) => socket.to(chatId).emit("stopTyping", { chatId, userId }));

    // SEND MESSAGE
    socket.on("sendMessage", async ({ chatId, content }) => {
      if (!content?.trim()) return;
      try {
        const chat = await Chat.findById(chatId).populate("participants", "username avatar");
        if (!chat) return;

        const newMessage = { sender: userId, content: content.trim(), timestamp: new Date() };
        chat.messages.push(newMessage);
        chat.lastMessage = new Date();
        await chat.save();
        await chat.populate("messages.sender", "username avatar");

        const savedMessage = chat.messages[chat.messages.length - 1];
        socket.to(chatId).emit("newMessage", { chatId, message: savedMessage });

        const receiver = chat.participants.find((p) => p._id.toString() !== userId);
        if (receiver) {
          const notification = await notificationService.createMessageNotification(
            chatId, userId, receiver._id, content.trim()
          );
          if (notification) io.to(receiver._id.toString()).emit("newNotification", notification);
        }
      } catch (err) {
        console.error("Error enviando mensaje:", err);
      }
    });

    // NOTIFICATIONS
    socket.on("markNotificationsRead", async (ids) => {
      try {
        const result = await notificationService.markAsRead(ids, userId);
        socket.emit("unreadCountUpdated", { unreadCount: result.unreadCount });
      } catch (err) {
        socket.emit("notificationError", { error: "Error marcando notificaciones" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Usuario desconectado: ${username} (${userId})`);
    });
  });

  return io;
};
