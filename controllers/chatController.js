import Chat from '../models/Chat.js';
import User from '../models/User.js';

export const chatController = {
  // Obtener chats del usuario
  getUserChats: async (req, res) => {
    try {
      const chats = await Chat.find({ 
        participants: req.user.id 
      }).populate('participants', 'username avatar email')
        .sort({ lastMessage: -1 });
      
      res.json({ success: true, chats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Crear nuevo chat
  createChat: async (req, res) => {
    try {
      const { participantId } = req.body;
      
      // Verificar si el chat ya existe
      let chat = await Chat.findOne({
        participants: { $all: [req.user.id, participantId] }
      });

      if (!chat) {
        chat = new Chat({
          participants: [req.user.id, participantId],
          messages: []
        });
        await chat.save();
      }

      await chat.populate('participants', 'username avatar email');
      res.json({ success: true, chat });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Enviar mensaje
  sendMessage: async (req, res) => {
    try {
      const { chatId } = req.params;
      const { content } = req.body;

      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ success: false, error: 'Chat no encontrado' });
      }

      // Verificar que el usuario pertenece al chat
      if (!chat.participants.includes(req.user.id)) {
        return res.status(403).json({ success: false, error: 'No tienes acceso a este chat' });
      }

      const newMessage = {
        sender: req.user.id,
        content: content,
        timestamp: new Date()
      };

      chat.messages.push(newMessage);
      chat.lastMessage = new Date();
      await chat.save();

      // Populate para enviar datos completos
      await chat.populate('messages.sender', 'username avatar');
      await chat.populate('participants', 'username avatar');

      // Socket.io (si lo implementas)
      if (req.app.get('io')) {
        req.app.get('io').to(chatId).emit('newMessage', {
          chatId,
          message: chat.messages[chat.messages.length - 1]
        });
      }

      res.json({ success: true, message: chat.messages[chat.messages.length - 1] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Obtener mensajes de un chat
  getChatMessages: async (req, res) => {
    try {
      const { chatId } = req.params;
      
      const chat = await Chat.findById(chatId)
        .populate('participants', 'username avatar email')
        .populate('messages.sender', 'username avatar');

      if (!chat) {
        return res.status(404).json({ success: false, error: 'Chat no encontrado' });
      }

      // Verificar acceso
      if (!chat.participants.some(p => p._id.toString() === req.user.id)) {
        return res.status(403).json({ success: false, error: 'Acceso denegado' });
      }

      res.json({ success: true, chat });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Eliminar chat
  deleteChat: async (req, res) => {
    try {
      const { chatId } = req.params;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ success: false, error: 'Chat no encontrado' });
      }

      // Verificar que el usuario pertenece al chat
      if (!chat.participants.includes(req.user.id)) {
        return res.status(403).json({ success: false, error: 'No tienes acceso a este chat' });
      }

      await Chat.findByIdAndDelete(chatId);
      res.json({ success: true, message: 'Chat eliminado correctamente' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export default chatController;