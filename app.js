import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import chatRoutes from "./routes/chat.js";
import notificationRoutes from "./routes/notifications.js";

// Models
import User from "./models/User.js";
import Chat from "./models/Chat.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Servir archivos estáticos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Crear directorio uploads si no existe
import fs from "fs";
import { notificationService } from "./controllers/notificationService.js";
const uploadsDir = path.join(__dirname, "uploads");
const avatarsDir = path.join(uploadsDir, "avatars");
const postsDir = path.join(uploadsDir, "posts");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/miniredsocial")
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error conectando a MongoDB:", err));

// Middleware para verificar token en sockets
const authenticateSocket = async (socket, next) => {
  try {
    const userId = socket.handshake.query.userId;

    console.log("🔌 Socket handshake data:", {
      userId: userId,
      auth: socket.handshake.auth,
      query: socket.handshake.query
    });

    // Validación robusta del userId
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.log("❌ Socket rechazado: userId no válido", userId);
      return next(new Error("Authentication error: userId required"));
    }

    // Validar que sea un ObjectId válido
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
    if (!isValidObjectId) {
      console.log("❌ Socket rechazado: userId no es un ObjectId válido", userId);
      return next(new Error("Authentication error: invalid userId format"));
    }

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ Socket rechazado: usuario no encontrado");
      return next(new Error("Authentication error: user not found"));
    }

    // Adjuntar user al socket para uso posterior
    socket.userId = userId;
    socket.user = user;
    
    console.log(`✅ Socket autenticado para usuario: ${user.username} (${userId})`);
    next();
  } catch (error) {
    console.error("Error en autenticación socket:", error);
    
    // Manejar específicamente errores de cast de MongoDB
    if (error.name === 'CastError') {
      return next(new Error("Authentication error: invalid user ID format"));
    }
    
    next(new Error("Authentication error"));
  }
};

// Aplicar middleware de autenticación a todos los sockets
io.use(authenticateSocket);

// Socket.io para chat en tiempo real y notificaciones
app.set("io", io);
io.on("connection", (socket) => {
  const userId = socket.userId;
  const username = socket.user?.username;

  if (!userId) {
    console.log("❌ Socket sin userId, desconectando...");
    socket.disconnect();
    return;
  }

  // Sala privada del usuario para notificaciones
  socket.join(userId);
  console.log(`🔌 Usuario conectado: ${socket.id}, userId: ${userId}, username: ${username}`);

  // Manejar reautenticación después de reconexión
  socket.on("reauthenticate", ({ userId: newUserId }) => {
    if (newUserId && newUserId === userId) {
      console.log(`✅ Usuario reautenticado: ${userId}`);
      socket.join(userId);
    }
  });

  /* ------------------ JOIN/LEAVE CHAT (EXISTENTE) ------------------ */
  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
    console.log(`Usuario ${username} se unió al chat ${chatId}`);
  });

  socket.on("leaveChat", (chatId) => {
    socket.leave(chatId);
    console.log(`Usuario ${username} dejó el chat ${chatId}`);
  });

  /* ------------------ TYPING (EXISTENTE) ------------------ */
  socket.on("typing", ({ chatId }) => {
    socket.to(chatId).emit("typing", { chatId, userId });
    console.log(`⌨️ ${username} está escribiendo en chat ${chatId}`);
  });

  socket.on("stopTyping", ({ chatId }) => {
    socket.to(chatId).emit("stopTyping", { chatId, userId });
  });

  /* ------------------ SEND MESSAGE (EXISTENTE) ------------------ */
  socket.on("sendMessage", async ({ chatId, content }) => {
    if (!content?.trim()) return;

    try {
      const chat = await Chat.findById(chatId).populate(
        "participants",
        "username avatar"
      );
      if (!chat) return;

      if (!chat.participants.some((p) => p._id.toString() === userId)) return;

      const newMessage = {
        sender: userId,
        content: content.trim(),
        timestamp: new Date(),
      };

      chat.messages.push(newMessage);
      chat.lastMessage = new Date();
      await chat.save();

      // Poblar sender para enviar a los clientes
      await chat.populate("messages.sender", "username avatar");

      const savedMessage = chat.messages[chat.messages.length - 1];

      // Emitir mensaje a la sala del chat
      io.to(chatId).emit("newMessage", { chatId, message: savedMessage });
      console.log(`💬 Mensaje enviado por ${username} en chat ${chatId}`);

      // NOTIFICACIÓN DE MENSAJE - USANDO TU SERVICIO
      const receiver = chat.participants.find(p => p._id.toString() !== userId);
      if (receiver) {
        const notification = await notificationService.createMessageNotification(
          chatId,
          userId,
          receiver._id,
          content.trim()
        );

        if (notification) {
          io.to(receiver._id.toString()).emit("newNotification", notification);
          console.log(`✅ Notificación de mensaje enviada a ${receiver.username}`);
        }
      }

    } catch (err) {
      console.error("Error enviando mensaje:", err);
    }
  });

  /* ------------------ NOTIFICACIONES (NUEVO) ------------------ */
  socket.on("markNotificationsRead", async (notificationIds) => {
    try {
      console.log(`📢 Marcando notificaciones como leídas:`, notificationIds);
      
      // Usar tu servicio de notificaciones
      const result = await notificationService.markAsRead(notificationIds, userId);

      // Emitir actualización del contador
      socket.emit("unreadCountUpdated", { unreadCount: result.unreadCount });
      console.log(`✅ Contador actualizado para ${username}: ${result.unreadCount} no leídas`);

    } catch (error) {
      console.error("Error marcando notificaciones como leídas:", error);
      socket.emit("notificationError", { error: "Error marcando notificaciones" });
    }
  });

  /* ------------------ NOTIFICACIÓN DE LIKE (NUEVO) ------------------ */
  socket.on("postLiked", async ({ postId, likerId, postAuthorId }) => {
    try {
      console.log(`❤️ Like recibido - Post: ${postId}, LikedBy: ${likerId}, Author: ${postAuthorId}`);
      
      // Usar tu servicio de notificaciones
      const notification = await notificationService.createLikeNotification(
        postId, 
        likerId, 
        postAuthorId
      );

      if (notification) {
        // Emitir notificación al autor del post
        io.to(postAuthorId).emit("newNotification", notification);
        console.log(`✅ Notificación de like enviada a ${postAuthorId}`);
      }

    } catch (error) {
      console.error("Error en notificación de like:", error);
    }
  });

  /* ------------------ NOTIFICACIÓN DE COMENTARIO (NUEVO) ------------------ */
  socket.on("newComment", async ({ postId, commenterId, commentContent, postAuthorId }) => {
    try {
      console.log(`💬 Comentario recibido - Post: ${postId}, CommentBy: ${commenterId}`);
      
      // Usar tu servicio de notificaciones
      const notification = await notificationService.createCommentNotification(
        postId, 
        commenterId, 
        postAuthorId, 
        commentContent
      );

      if (notification) {
        io.to(postAuthorId).emit("newNotification", notification);
        console.log(`✅ Notificación de comentario enviada a ${postAuthorId}`);
      }

    } catch (error) {
      console.error("Error en notificación de comentario:", error);
    }
  });

  /* ------------------ NEW POST (EXISTENTE - SI LO TIENES) ------------------ */
  socket.on("newPost", async (postData) => {
    try {
      console.log(`📝 Nuevo post por ${username}`);
      // Aquí puedes agregar lógica para notificar a seguidores si lo necesitas
      // Por ejemplo: io.to(seguidorId).emit("newPostNotification", postData);
    } catch (error) {
      console.error("Error manejando nuevo post:", error);
    }
  });

  /* ------------------ DISCONNECT (EXISTENTE) ------------------ */
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Usuario desconectado: ${username} (${userId}) - Razón: ${reason}`);
  });
});

// Routes (EXISTENTES - SIN CAMBIOS)
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/notifications", notificationRoutes);

// Ruta de salud (EXISTENTE)
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Servidor funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});

// Manejo de errores global (EXISTENTE)
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);
  res.status(500).json({
    success: false,
    error: "Error interno del servidor",
  });
});

// Ruta 404 (EXISTENTE)
app.all('/{*splat}', (req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📱 Frontend: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
});

export default app;