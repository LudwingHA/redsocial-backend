import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

class SocketManager {
  constructor() {
    this.socket = null;
    this.isInitializing = false;
    this.connectCallbacks = [];
    this.currentUser = null;
  }

  initSocket(user) {
    if (this.socket?.connected && this.currentUser?._id === user?._id) {
      return this.socket;
    }

    if (this.isInitializing) {
      return new Promise((resolve) => {
        this.connectCallbacks.push(resolve);
      });
    }

    this.isInitializing = true;
    this.currentUser = user;

    return new Promise((resolve, reject) => {
      try {
        // Cerrar socket existente si hay uno
        if (this.socket) {
          this.socket.disconnect();
        }

        console.log("🔌 Conectando socket con userId:", user?._id);

        this.socket = io(SOCKET_URL, {
          withCredentials: true,
          query: user ? { userId: user._id } : {},
          autoConnect: true,
          transports: ["websocket", "polling"] // Agregar transports explícitamente
        });

        this.socket.on("connect", () => {
          console.log("🔌 Socket global conectado:", this.socket.id, "userId:", user?._id);
          this.isInitializing = false;
          
          // Ejecutar todos los callbacks en espera
          this.connectCallbacks.forEach(callback => callback(this.socket));
          this.connectCallbacks = [];
          
          resolve(this.socket);
        });

        this.socket.on("disconnect", (reason) => {
          console.log("🔌 Socket global desconectado:", reason);
        });

        this.socket.on("connect_error", (error) => {
          console.error("🔌 Error de conexión socket:", error);
          this.isInitializing = false;
          this.connectCallbacks = [];
          reject(error);
        });

        // Reconexión automática
        this.socket.on("reconnect", (attemptNumber) => {
          console.log(`🔌 Socket reconectado después de ${attemptNumber} intentos`);
          // Re-enviar el userId después de reconexión
          if (this.currentUser) {
            this.socket.emit("reauthenticate", { userId: this.currentUser._id });
          }
        });

      } catch (error) {
        console.error("Error inicializando socket:", error);
        this.isInitializing = false;
        this.connectCallbacks = [];
        reject(error);
      }
    });
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isInitializing = false;
    this.connectCallbacks = [];
    this.currentUser = null;
  }

  // Método helper para esperar conexión
  async waitForConnection() {
    if (this.socket?.connected) {
      return this.socket;
    }
    
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        resolve(this.socket);
      } else {
        this.connectCallbacks.push(resolve);
      }
    });
  }
}

// Instancia global única
const socketManager = new SocketManager();
export default socketManager;