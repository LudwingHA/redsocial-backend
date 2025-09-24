import { createServer } from "http";
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { setupSocket } from "./config/socket.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

// DB
connectDB();

// Server + Socket
const server = createServer(app);
const io = setupSocket(server);

app.set("io", io);

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});
