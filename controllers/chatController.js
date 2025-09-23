import Chat from '../models/Chat.js';
import User from '../models/User.js';

export const chatController = {
  getUserChats: async (req, res) => {
    try {
      const chats = await Chat.find({
        participants: { $in: [req.user.id] }
      })
        .populate('participants', 'username avatar email')
        .populate('messages.sender', 'username avatar')
        .sort({ lastMessage: -1 });
      
      res.json({ success: true, chats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  createChat: async (req, res) => {
    try {
      const { participantId } = req.body;

      if (!participantId) return res.status(400).json({ success: false, error: 'Falta participantId' });

      let chat = await Chat.findOne({
        participants: { $all: [req.user.id, participantId] }
      }).populate('participants', 'username avatar email');

      if (!chat) {
        chat = new Chat({ 
          participants: [req.user.id, participantId], 
          messages: [] 
        });
        await chat.save();
        await chat.populate('participants', 'username avatar email');
      }

      res.json({ success: true, chat });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  sendMessage: async (req, res) => {
    try {
      const { chatId } = req.params;
      const { content } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({ success: false, error: "Mensaje vacío" });
      }

      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ success: false, error: "Chat no encontrado" });
      }

      if (!chat.participants.includes(req.user.id)) {
        return res.status(403).json({ success: false, error: "No tienes acceso" });
      }

      const newMessage = { 
        sender: req.user.id, 
        content, 
        timestamp: new Date() 
      };
      
      chat.messages.push(newMessage);
      chat.lastMessage = new Date();
      await chat.save();

      // Poblar el mensaje recién creado
      const populatedChat = await Chat.findById(chatId)
        .populate('messages.sender', 'username avatar')
        .populate('participants', 'username avatar');

      const savedMessage = populatedChat.messages[populatedChat.messages.length - 1];

      // Emitir a través de Socket.io
      const io = req.app.get("io");
      io.to(chatId).emit("newMessage", { 
        chatId, 
        message: savedMessage 
      });

      res.json({ success: true, message: savedMessage });
    } catch (error) {
      console.error("Error en sendMessage:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getChatMessages: async (req, res) => {
    try {
      const { chatId } = req.params;
      const chat = await Chat.findById(chatId)
        .populate('participants', 'username avatar email')
        .populate('messages.sender', 'username avatar');

      if (!chat) return res.status(404).json({ success: false, error: 'Chat no encontrado' });
      
      if (!chat.participants.some(p => p._id.toString() === req.user.id)) {
        return res.status(403).json({ success: false, error: 'Acceso denegado' });
      }

      res.json({ success: true, chat: { ...chat.toObject(), messages: chat.messages } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteChat: async (req, res) => {
    try {
      const { chatId } = req.params;
      const chat = await Chat.findById(chatId);
      
      if (!chat) return res.status(404).json({ success: false, error: 'Chat no encontrado' });
      if (!chat.participants.includes(req.user.id)) {
        return res.status(403).json({ success: false, error: 'No tienes acceso' });
      }

      await Chat.findByIdAndDelete(chatId);
      res.json({ success: true, message: 'Chat eliminado' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export default chatController;