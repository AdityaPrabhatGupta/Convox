import { io } from "socket.io-client";
import { addNotification } from "./notificationStore.js";
import { playNotificationSound } from "./notificationSound.js";
import { getCurrentUserId } from "../utils/auth.js";

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket = io(socketUrl, {
  autoConnect: true,
  withCredentials: true,
});

let currentChatId = null;
const messageListeners = new Set();
const notificationListeners = new Set();

function notifyUserConnected() {
  const userId = getCurrentUserId();
  if (!userId) return;

  socket.emit("setup", userId);
  socket.emit("user_connected", { userId });
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

socket.off("connect", notifyUserConnected);
socket.on("connect", notifyUserConnected);

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

export function joinChat(chatId) {
  const nextChatId = String(chatId);
  if (!nextChatId || currentChatId === nextChatId) return;

  if (currentChatId) {
    socket.emit("leaveChat", { chatId: currentChatId });
    socket.emit("leave_chat", { chatId: currentChatId });
  }

  socket.emit("joinChat", nextChatId);
  socket.emit("join_chat", { chatId: nextChatId });
  currentChatId = nextChatId;
}

export function leaveCurrentChat() {
  if (!currentChatId) return;

  socket.emit("leaveChat", { chatId: currentChatId });
  socket.emit("leave_chat", { chatId: currentChatId });
  currentChatId = null;
}

export function getCurrentChatId() {
  return currentChatId;
}

export function sendMessage(message) {
  socket.emit("sendMessage", message);
  socket.emit("send_message", message);
}