// Maps socketId -> chatId for the chat a socket is actively viewing.
const userActiveChat = new Map();

export function setActiveChat(socketId, chatId) {
  userActiveChat.set(socketId, String(chatId));
}

export function clearActiveChat(socketId) {
  userActiveChat.delete(socketId);
}

export function isViewingChat(socketId, chatId) {
  return userActiveChat.get(socketId) === String(chatId);
}
