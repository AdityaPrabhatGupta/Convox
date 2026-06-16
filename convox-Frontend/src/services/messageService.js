import axiosInstance from "./axiosInstance.js";

export async function fetchMessages(chatId, options = {}) {
  const params = {};
  if (options.limit) params.limit = options.limit;
  if (options.before) params.before = options.before;

  const response = await axiosInstance.get(`/api/messages/${chatId}`, { params });
  return {
    messages: response.data?.data || [],
    pagination: response.data?.pagination || {
      limit: options.limit || 30,
      hasMore: false,
      nextCursor: null,
    },
  };
}

export async function sendMessage({ chatId, content, replyTo }) {
  const response = await axiosInstance.post("/api/messages", {
    chatId,
    content,
    replyTo,
  });

  return response.data?.data;
}

export async function uploadMediaMessage({ chatId, file, replyTo, voiceDuration, onUploadProgress }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chatId", chatId);
  if (replyTo) {
    formData.append("replyTo", replyTo);
  }
  if (voiceDuration != null) {
    formData.append("voiceDuration", voiceDuration);
  }

  const response = await axiosInstance.post("/api/messages/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress(progressEvent) {
      if (!progressEvent.total || !onUploadProgress) return;
      onUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
    },
  });

  return response.data?.data;
}

export async function reactToMessage(messageId, emoji) {
  const response = await axiosInstance.patch(`/api/messages/${messageId}/react`, {
    emoji,
  });
  return response.data?.data;
}

export async function togglePinMessage(messageId) {
  const response = await axiosInstance.patch(`/api/messages/${messageId}/pin`);
  return response.data?.data;
}

export async function editMessage(messageId, content) {
  const response = await axiosInstance.patch(`/api/messages/${messageId}/edit`, {
    content,
  });
  return response.data?.data;
}

export async function deleteMessageForMe(messageId) {
  const response = await axiosInstance.patch(`/api/messages/${messageId}/delete-for-me`);
  return response.data;
}

export async function deleteMessageForEveryone(messageId) {
  const response = await axiosInstance.patch(`/api/messages/${messageId}/delete-for-everyone`);
  return response.data?.data;
}

export async function forwardMessages(messageIds, targetChatIds) {
  const response = await axiosInstance.post("/api/messages/forward", {
    messageIds,
    targetChatIds,
  });
  return response.data?.data || [];
}

export async function clearChatMessages(chatId) {
  const response = await axiosInstance.delete(`/api/messages/chat/${chatId}/clear`);
  return response.data;
}
