import { Server } from "socket.io";

let io: Server;

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized!");
  }
  return io;
}

export function initSocket(server: any) {
  if (io) return io;
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("admin:join", () => {
      socket.join("admins");
      console.log("Admin joined");
    });
  });

  return io;
}
