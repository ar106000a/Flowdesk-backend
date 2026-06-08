// This file owns the io instance
// index.js calls initSocket() to attach it to the HTTP server
// Controllers import { io } from here — no circular dependency

import { Server } from "socket.io";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on("join_project", (projectId) => {
      socket.join(`project:${projectId}`);
      console.log(`[Socket] ${socket.id} joined project:${projectId}`);
    });

    socket.on("leave_project", (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io)
    throw new Error("Socket.io not initialized — call initSocket() first");
  return io;
}
