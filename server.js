import { createServer } from "http";
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { setupSocket } from "./config/socket.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

// Crear server + socket
const server = createServer(app);
const io = setupSocket(server);
app.set("io", io);

// Health check inmediato
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Levantar servidor de inmediato
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Conectar a MongoDB en segundo plano
connectDB().catch((err) => {
  console.error("❌ Error conectando a MongoDB:", err);
});
