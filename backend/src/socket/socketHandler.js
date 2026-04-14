import {
  setActiveChat,
  clearActiveChat,
  isViewingChat,
} from "./roomTracker.js";
import {
  registerUser,
  removeUser,
  getSocketIds,
  getOnlineUserIds,
} from "./userSocketMap.js";

function normalizeUserId(payload) {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") return payload.userId ?? null;
  return null;
}

function normalizeChatId(payload) {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") return payload.chatId ?? null;
  return null;
}

function buildOutboundMessage(payload = {}) {
  const chatId = payload.chatId ?? payload.chat?._id;
  const senderId = payload.senderId ?? payload.sender?._id;
  const senderName = payload.senderName ?? payload.sender?.name ?? "Someone";
  const content = payload.content ?? payload.text ?? "";

  if (!chatId || !senderId || !content) return null;

  return {
    _id: payload._id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    chat: payload.chat ?? { _id: String(chatId) },
    chatId: String(chatId),
    sender: payload.sender ?? { _id: String(senderId), name: senderName },
    senderId: String(senderId),
    senderName,
    content,
    createdAt: payload.createdAt ?? new Date().toISOString(),
  };
}

function getParticipantIds(message, payload = {}) {
  const fromPayload = Array.isArray(payload.participantIds)
    ? payload.participantIds
    : [];
  const fromChatUsers = Array.isArray(message.chat?.users)
    ? message.chat.users.map((user) =>
        typeof user === "object" ? user?._id ?? user?.id : user,
      )
    : [];

  return [...new Set([...fromPayload, ...fromChatUsers].filter(Boolean).map(String))];
}

const initializeSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`Connected | socket.id: ${socket.id}`);

    const handleUserConnected = (payload) => {
      const userId = normalizeUserId(payload);
      if (!userId) {
        console.warn("Setup called without userId");
        return;
      }

      registerUser(userId, socket.id);
      socket.userId = String(userId);
      socket.join(String(userId));

      socket.emit("connected", String(userId));
      socket.broadcast.emit("userOnline", String(userId));
      socket.emit("onlineUsers", getOnlineUserIds());
    };

    const handleJoinChat = (payload) => {
      const chatId = normalizeChatId(payload);
      if (!chatId) {
        console.warn("joinChat called without chatId");
        return;
      }

      const nextRoom = String(chatId);
      const prevRooms = [...socket.rooms].filter(
        (room) => room !== socket.id && room !== String(socket.userId),
      );

      prevRooms.forEach((room) => socket.leave(room));
      socket.join(nextRoom);
      setActiveChat(socket.id, nextRoom);
      console.log(`Socket joined chat room | chatId: ${nextRoom}`);
    };

    const handleLeaveChat = (payload) => {
      const chatId = normalizeChatId(payload);
      if (chatId) {
        socket.leave(String(chatId));
      }
      clearActiveChat(socket.id);
    };

    const handleSendMessage = (payload) => {
      const message = buildOutboundMessage(payload);
      if (!message) {
        console.warn("sendMessage received invalid payload");
        return;
      }

      const chatId = message.chatId;
      socket.to(chatId).emit("messageReceived", message);

      const participantIds = getParticipantIds(message, payload);
      participantIds.forEach((participantId) => {
        if (participantId === String(message.senderId)) return;

        const participantSockets = getSocketIds(participantId);
        participantSockets.forEach((participantSocketId) => {
          if (isViewingChat(participantSocketId, chatId)) return;

          io.to(participantSocketId).emit("new_notification", {
            chatId,
            senderId: String(message.senderId),
            senderName: message.senderName,
            preview: String(message.content).slice(0, 60),
            timestamp: message.createdAt,
          });
        });
      });

      console.log(`Message sent | chatId: ${chatId} | from: ${message.senderId}`);
    };

    socket.on("setup", handleUserConnected);
    socket.on("user_connected", handleUserConnected);

    socket.on("joinChat", handleJoinChat);
    socket.on("join_chat", handleJoinChat);

    socket.on("leaveChat", handleLeaveChat);
    socket.on("leave_chat", handleLeaveChat);

    socket.on("sendMessage", handleSendMessage);
    socket.on("send_message", handleSendMessage);

    socket.on("typing", (data) => {
      if (!data?.chatId) return;
      socket.to(String(data.chatId)).emit("typing", data);
    });

    socket.on("stopTyping", (data) => {
      if (!data?.chatId) return;
      socket.to(String(data.chatId)).emit("stopTyping", data);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Disconnected | socket.id: ${socket.id} | reason: ${reason}`);

      clearActiveChat(socket.id);

      const userId = socket.userId;
      if (!userId) return;

      removeUser(socket.id);

      if (getSocketIds(userId).length === 0) {
        socket.broadcast.emit("userOffline", String(userId));
      }
    });
  });
};

export default initializeSocket;
