import { createServer } from "http";
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { setupSocket } from "./config/socket.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Esperar conexión a MongoDB
    await connectDB();

    // Crear server + socket
    const server = createServer(app);
    const io = setupSocket(server);
    app.set("io", io);

    // Levantar servidor
    server.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error("❌ Error arrancando el servidor:", err);
    process.exit(1);
  }
};

// Ejecutar
startServer();
