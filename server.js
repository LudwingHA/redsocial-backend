import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import publicRoutes from "./routes/publicRoutes.js"
import privateRoutes from "./routes/privateRoutes.js"
import path from "path";
import { fileURLToPath } from "url";
import Message from "./models/Message.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("userConnected", (userId) => {
    onlineUsers.push({ userId, socketId: socket.id });
    io.emit("onlineUsers", onlineUsers.map(u => u.userId));
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter(u => u.socketId !== socket.id);
    io.emit("onlineUsers", onlineUsers.map(u => u.userId));
    console.log("Usuario desconectado:", socket.id);
  });

  socket.on("sendMessage", async ({ sender, receiver, text }) => {
    const msg = { sender, receiver, text, createdAt: new Date() };
    const receiverSocket = onlineUsers.find(u => u.userId === receiver)?.socketId;

    if (receiverSocket) {
      io.to(receiverSocket).emit("receiveMessage", msg);
    }

    try {
      const message = new Message(msg);
      await message.save();
    } catch (err) {
      console.error("Error guardando mensaje:", err.message);
    }
  });
});
app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Rutas
app.use("/api", publicRoutes);
app.use("/api", privateRoutes);

// Socket.io
io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // Recibir mensaje
  socket.on("sendMessage", (data) => {
    // data = { sender, receiver, text }
    io.to(data.receiver).emit("receiveMessage", data);
  });

  // Unirse a sala personal
  socket.on("joinRoom", (userId) => {
    socket.join(userId); // cada usuario tiene su sala
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado:", socket.id);
  });
});

// Conectar a Mongo
const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => server.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => console.log(err));
