// Maps userId -> Set<socketId> so a user can stay connected across tabs.
const userSocketMap = new Map();

export function registerUser(userId, socketId) {
  const id = String(userId);
  if (!userSocketMap.has(id)) {
    userSocketMap.set(id, new Set());
  }

  userSocketMap.get(id).add(socketId);
}

export function removeUser(socketId) {
  for (const [userId, socketIds] of userSocketMap.entries()) {
    if (!socketIds.has(socketId)) continue;

    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      userSocketMap.delete(userId);
    }
    break;
  }
}

export function getSocketId(userId) {
  const sockets = userSocketMap.get(String(userId));
  if (!sockets || sockets.size === 0) return null;
  return sockets.values().next().value ?? null;
}

export function getSocketIds(userId) {
  return [...(userSocketMap.get(String(userId)) ?? [])];
}

export function getOnlineUserIds() {
  return [...userSocketMap.keys()];
}
