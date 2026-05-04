import { setActiveChat, clearActiveChat } from "./roomTracker.js";
import {
  registerUser,
  removeUser,
  getSocketIds,
  getOnlineUserIds,
} from "./userSocketMap.js";
import {
  getCallState,
  registerCallPair,
  updateCallPairStatus,
  removeCallPair,
} from "./callSessionRegistry.js";
import { User, Chat, Message } from "../models/index.js";
import { io } from "./socket.js";
import logger from "../config/logger.js";

async function saveCallLog({ callerId, calleeId, callType, outcome, duration = 0 }) {
  try {
    const chat = await Chat.findOne({
      users: { $all: [callerId, calleeId] },
      isGroupChat: false,
    }).lean();

    if (!chat) return;

    const created = await Message.create({
      sender: callerId,
      chat: chat._id,
      type: "call_log",
      content: "",
      isSystem: true,
      callMeta: { callType, outcome, duration },
    });

    await Chat.findByIdAndUpdate(chat._id, { latestMessage: created._id });

    const payload = {
      _id: created._id,
      content: "",
      createdAt: created.createdAt,
      chat: { _id: chat._id, users: chat.users },
      chatId: String(chat._id),
      sender: { _id: callerId },
      senderId: String(callerId),
      type: "call_log",
      isSystem: true,
      callMeta: { callType, outcome, duration },
      participantIds: chat.users.map(String),
    };

    io.to(String(chat._id)).emit("messageReceived", payload);
    [callerId, calleeId].forEach((uid) => {
      getSocketIds(String(uid)).forEach((sid) => {
        io.to(sid).emit("messageReceived", payload);
      });
    });
  } catch (error) {
    logger.error("Failed to persist call log", { error: error.message, callerId, calleeId });
  }
}

function normalizeChatId(payload) {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") return payload.chatId ?? null;
  return null;
}

const initializeSocket = (socketServer) => {
  socketServer.on("connection", (socket) => {
    const authenticatedUserId = String(socket.userId);

    registerUser(authenticatedUserId, socket.id);
    socket.join(authenticatedUserId);
    socket.emit("connected", authenticatedUserId);
    socket.emit("onlineUsers", getOnlineUserIds());
    socket.broadcast.emit("userOnline", authenticatedUserId);

    User.updateOne({ _id: authenticatedUserId }, { $set: { lastSeen: new Date() } }).catch((error) => {
      logger.warn("Failed to refresh last seen on connect", { error: error.message, userId: authenticatedUserId });
    });

    logger.info("Socket connected", {
      socketId: socket.id,
      userId: authenticatedUserId,
    });

    socket.on("setup", () => {
      socket.emit("connected", authenticatedUserId);
    });

    const handleJoinChat = (payload) => {
      const chatId = normalizeChatId(payload);
      if (!chatId) return;

      const nextRoom = String(chatId);
      const prevRooms = [...socket.rooms].filter(
        (room) => room !== socket.id && room !== authenticatedUserId,
      );

      prevRooms.forEach((room) => socket.leave(room));
      socket.join(nextRoom);
      setActiveChat(socket.id, nextRoom);
      logger.debug("Socket joined chat room", { socketId: socket.id, chatId: nextRoom });
    };

    const handleLeaveChat = (payload) => {
      const chatId = normalizeChatId(payload);
      if (chatId) {
        socket.leave(String(chatId));
      }
      clearActiveChat(socket.id);
    };

    socket.on("joinChat", handleJoinChat);
    socket.on("join_chat", handleJoinChat);
    socket.on("leaveChat", handleLeaveChat);
    socket.on("leave_chat", handleLeaveChat);

    socket.on("typing", (data) => {
      if (!data?.chatId) return;
      socket.to(String(data.chatId)).emit("typing", data);
    });

    socket.on("stopTyping", (data) => {
      if (!data?.chatId) return;
      socket.to(String(data.chatId)).emit("stopTyping", data);
    });

    socket.on("call-user", (payload) => {
      const { targetUserId, offer, callerName, callType = "video" } = payload || {};

      if (!targetUserId || !offer) {
        socket.emit("call-error", { message: "Invalid call payload." });
        return;
      }

      const staleCallerEntry = getCallState(authenticatedUserId);
      if (staleCallerEntry) {
        logger.warn("Clearing stale call registry entry", { userId: authenticatedUserId });
        removeCallPair(authenticatedUserId);
      }

      if (getCallState(String(targetUserId))) {
        socket.emit("call-rejected", {
          reason: "busy",
          message: "That user is already in another call.",
        });
        return;
      }

      const targetSocketIds = getSocketIds(String(targetUserId));
      if (!targetSocketIds.length) {
        socket.emit("call-rejected", {
          reason: "offline",
          message: `${targetUserId} is not online right now.`,
        });
        saveCallLog({
          callerId: authenticatedUserId,
          calleeId: String(targetUserId),
          callType,
          outcome: "missed",
        });
        return;
      }

      registerCallPair(authenticatedUserId, String(targetUserId), "ringing", callType);

      targetSocketIds.forEach((socketId) => {
        io.to(socketId).emit("incoming-call", {
          offer,
          callerId: authenticatedUserId,
          callerName: callerName || socket.user?.name || "Someone",
          callType,
        });
      });
    });

    socket.on("accept-call", (payload) => {
      const { callerId, answer } = payload || {};

      if (!callerId || !answer) {
        socket.emit("call-error", { message: "Invalid accept-call payload." });
        return;
      }

      const currentCall = getCallState(authenticatedUserId);
      if (!currentCall || currentCall.peerId !== String(callerId)) {
        socket.emit("call-error", { message: "This call is no longer available." });
        return;
      }

      const callerSocketIds = getSocketIds(String(callerId));
      if (!callerSocketIds.length) {
        socket.emit("call-error", { message: "Caller disconnected before answer arrived." });
        removeCallPair(authenticatedUserId);
        return;
      }

      updateCallPairStatus(authenticatedUserId, "connected");
      callerSocketIds.forEach((socketId) => {
        io.to(socketId).emit("call-accepted", {
          answer,
          calleeId: authenticatedUserId,
        });
      });
    });

    socket.on("reject-call", (payload) => {
      const { callerId } = payload || {};
      if (!callerId) return;

      const currentCall = getCallState(authenticatedUserId);
      if (!currentCall || currentCall.peerId !== String(callerId)) return;

      const savedCallType = currentCall.callType || "audio";
      removeCallPair(authenticatedUserId);

      getSocketIds(String(callerId)).forEach((socketId) => {
        io.to(socketId).emit("call-rejected", {
          calleeId: authenticatedUserId,
          reason: "rejected",
        });
      });

      saveCallLog({
        callerId: String(callerId),
        calleeId: authenticatedUserId,
        callType: savedCallType,
        outcome: "declined",
      });
    });

    socket.on("end-call", (payload) => {
      const { targetUserId } = payload || {};
      if (!targetUserId) return;

      const currentCall = getCallState(authenticatedUserId);
      if (!currentCall || currentCall.peerId !== String(targetUserId)) return;

      const startedAt = currentCall.startedAt || null;
      const duration = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

      removeCallPair(authenticatedUserId);

      getSocketIds(String(targetUserId)).forEach((socketId) => {
        io.to(socketId).emit("call-ended", { by: authenticatedUserId });
      });

      saveCallLog({
        callerId: authenticatedUserId,
        calleeId: String(targetUserId),
        callType: currentCall.callType || "audio",
        outcome: "ended",
        duration,
      });
    });

    socket.on("ice-candidate", (payload) => {
      const { targetUserId, candidate } = payload || {};
      if (!targetUserId || !candidate) return;

      getSocketIds(String(targetUserId)).forEach((socketId) => {
        io.to(socketId).emit("ice-candidate", {
          candidate,
          from: authenticatedUserId,
        });
      });
    });

    socket.on("disconnect", async (reason) => {
      logger.info("Socket disconnected", { socketId: socket.id, userId: authenticatedUserId, reason });
      clearActiveChat(socket.id);
      removeUser(socket.id);

      if (getSocketIds(authenticatedUserId).length === 0) {
        const callPeer = getCallState(authenticatedUserId)?.peerId;
        if (callPeer) {
          removeCallPair(authenticatedUserId);
          getSocketIds(String(callPeer)).forEach((socketId) => {
            io.to(socketId).emit("call-ended", {
              by: authenticatedUserId,
              reason: "disconnected",
            });
          });
        }

        try {
          await User.updateOne({ _id: authenticatedUserId }, { $set: { lastSeen: new Date() } });
        } catch (error) {
          logger.warn("Failed to persist last seen on disconnect", {
            error: error.message,
            userId: authenticatedUserId,
          });
        }

        socket.broadcast.emit("userOffline", authenticatedUserId);
      }
    });
  });
};

export default initializeSocket;
