import Message from "../models/Message.js";

// Enviar mensaje
export const sendMessage = async (req, res) => {
  try {
    const { receiver, text } = req.body;
    const sender = req.userId; // del JWT
    const newMessage = new Message({ sender, receiver, text });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Obtener mensajes entre dos usuarios
export const getMessages = async (req, res) => {
  try {
    const user1 = req.userId; // JWT
    const user2 = req.query.user2;
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
