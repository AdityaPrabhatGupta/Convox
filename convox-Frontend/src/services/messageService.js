import axiosInstance from "./axiosInstance.js";

export async function fetchMessages(chatId) {
  const response = await axiosInstance.get(`/api/messages/${chatId}`);
  return response.data?.data || [];
}

export async function sendMessage({ chatId, content }) {
  const response = await axiosInstance.post("/api/messages", {
    chatId,
    content,
  });

  return response.data?.data;
}
