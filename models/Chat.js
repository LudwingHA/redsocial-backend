import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 1000 },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  messages: [messageSchema],
  lastMessage: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Índices para búsquedas eficientes
chatSchema.index({ participants: 1 });
chatSchema.index({ lastMessage: -1 });

export default mongoose.model('Chat', chatSchema);
