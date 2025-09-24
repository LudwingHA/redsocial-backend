

import User from "../models/User.js";

export const authenticateSocket = async (socket, next) => {
  try {
    const userId = socket.handshake.query.userId;

    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return next(new Error("Authentication error: invalid userId"));
    }

    const user = await User.findById(userId);
    if (!user) return next(new Error("Authentication error: user not found"));

    socket.userId = userId;
    socket.user = user;
    next();
  } catch (error) {
    console.error("Error en autenticación socket:", error);
    next(new Error("Authentication error"));
  }
};
