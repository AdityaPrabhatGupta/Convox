import { useSyncExternalStore } from "react";

let state = { unreadChats: {} };
const listeners = new Set();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotifications() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function addNotification({
  chatId,
  senderId,
  senderName,
  preview,
  timestamp,
}) {
  const id = String(chatId);
  const existing = state.unreadChats[id] || { count: 0 };

  state = {
    unreadChats: {
      ...state.unreadChats,
      [id]: {
        count: existing.count + 1,
        senderId,
        lastSender: senderName,
        lastMessage: preview,
        timestamp,
      },
    },
  };

  emitChange();
}

export function clearNotification(chatId) {
  const id = String(chatId);
  if (!state.unreadChats[id]) return;

  const unreadChats = { ...state.unreadChats };
  delete unreadChats[id];
  state = { unreadChats };
  emitChange();
}

export function getUnread(chatId) {
  return state.unreadChats[String(chatId)] || null;
}

export function getTotalCount() {
  return Object.values(state.unreadChats).reduce(
    (count, unread) => count + unread.count,
    0,
  );
}
