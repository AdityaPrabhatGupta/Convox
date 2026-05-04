import { io } from "socket.io-client";
import { addNotification } from "./notificationStore.js";
import { playNotificationSound } from "./notificationSound.js";
import { getToken, refreshAccessToken } from "../utils/auth.js";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
});

let currentChatId = null;
const messageListeners = new Set();
const notificationListeners = new Set();
let socketRefreshPromise = null;

async function prepareSocketAuth() {
  let token = getToken();
  if (!token) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    token = getToken();
  }

  if (!token) return null;
  socket.auth = { token };
  return token;
}

async function refreshSocketAuth(forceRefresh = false) {
  if (!forceRefresh) {
    return prepareSocketAuth();
  }

  socketRefreshPromise ||= (async () => {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    return prepareSocketAuth();
  })().finally(() => {
    socketRefreshPromise = null;
  });

  return socketRefreshPromise;
}

// Register socket-level handlers exactly once using named functions so they
// can be cleanly removed if needed and never accidentally double-registered.
function handleMessageReceived(message) {
  messageListeners.forEach((listener) => listener(message));
}

function handleNewNotification(notification) {
  if (String(notification.chatId) === currentChatId) return;
  addNotification(notification);
  playNotificationSound();
  notificationListeners.forEach((listener) => listener(notification));
}

socket.off("messageReceived", handleMessageReceived);
socket.on("messageReceived", handleMessageReceived);

socket.off("new_notification", handleNewNotification);
socket.on("new_notification", handleNewNotification);

export function subscribeToMessages(listener) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function subscribeToNotifications(listener) {
  notificationListeners.add(listener);
  return () => notificationListeners.delete(listener);
}

/**
 * Connect the socket (safe to call multiple times — no-ops if already connected).
 * Should be called once the user is authenticated.
 */
export async function connectSocket() {
  if (socket.connected) return;
  const token = await prepareSocketAuth();
  if (!token) return;
  socket.connect();
}

socket.io.off("reconnect_attempt");
socket.io.on("reconnect_attempt", async () => {
  await prepareSocketAuth();
});

socket.off("connect_error");
socket.on("connect_error", async (error) => {
  const code = error?.data?.code || "";
  const message = String(error?.message || "");
  const invalidToken =
    code === "SOCKET_INVALID_TOKEN" ||
    code === "SOCKET_AUTH_REQUIRED" ||
    /invalid socket token|authentication required/i.test(message);

  if (!invalidToken) return;

  const token = await refreshSocketAuth(true);
  if (!token) {
    socket.disconnect();
    return;
  }

  if (!socket.connected) {
    socket.connect();
  }
});

/**
 * Disconnect the socket (e.g. on logout).
 */
export function disconnectSocket() {
  socket.disconnect();
}

export function joinChat(chatId) {
  const nextChatId = String(chatId);
  if (!nextChatId || currentChatId === nextChatId) return;

  if (currentChatId) {
    socket.emit("leaveChat", { chatId: currentChatId });
  }

  socket.emit("joinChat", nextChatId);
  currentChatId = nextChatId;
}

export function leaveCurrentChat() {
  if (!currentChatId) return;

  socket.emit("leaveChat", { chatId: currentChatId });
  currentChatId = null;
}

export function getCurrentChatId() {
  return currentChatId;
}
