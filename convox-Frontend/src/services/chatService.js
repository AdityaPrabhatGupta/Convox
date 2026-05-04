import axiosInstance from "./axiosInstance.js";

export async function fetchChats() {
  const response = await axiosInstance.get("/api/chat");
  return response.data?.chats || [];
}

export async function createOrFetchChat(userId) {
  const response = await axiosInstance.post("/api/chat", { userId });
  return response.data?.chat || null;
}

export async function removeDirectChat(chatId, options = {}) {
  const response = await axiosInstance.delete(`/api/chat/${chatId}`, {
    data: options,
  });
  return response.data || null;
}
