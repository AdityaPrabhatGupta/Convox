import { getSocketId } from "./userSocketMap.js";

let ioInstance = null;

export const setIoInstance = (io) => {
  ioInstance = io;
};

export const getReceiverSocketId = (userId) => getSocketId(userId);

export const io = {
  to(...args) {
    if (!ioInstance) {
      throw new Error("Socket.IO instance has not been initialized.");
    }

    return ioInstance.to(...args);
  },
};

