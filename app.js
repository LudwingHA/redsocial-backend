import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import chatRoutes from './routes/chat.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Crear directorio uploads si no existe
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const postsDir = path.join(uploadsDir, 'posts');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/redsocial')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Socket.io para chat en tiempo real
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 Usuario conectado:', socket.id);

  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`Usuario ${socket.id} se unió al chat ${chatId}`);
  });

  socket.on('leaveChat', (chatId) => {
    socket.leave(chatId);
    console.log(`Usuario ${socket.id} dejó el chat ${chatId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Usuario desconectado:', socket.id);
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del servidor' 
  });
});

// Ruta 404 - CORREGIDA (usa '*' como string)
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📱 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

export default app;