import axiosInstance from "./axiosInstance.js";

export async function sendAssistantMessage(chatId, content) {
  const response = await axiosInstance.post(`/api/assistant/${chatId}/message`, {
    content,
  });

  return response.data;
}

export async function getAssistantStatus(chatId) {
  const response = await axiosInstance.get(`/api/assistant/${chatId}/status`);
  return response.data;
}

export async function fetchSmartReplies(chatId) {
  try {
    const response = await axiosInstance.post(`/api/ai/${chatId}/smart-replies`);
    return response.data?.replies || [];
  } catch {
    return [];
  }
}

export async function fetchChatSummary(chatId) {
  try {
    const response = await axiosInstance.post(`/api/ai/${chatId}/summarize`);
    return response.data?.summary || null;
  } catch {
    return null;
  }
}

export async function askAboutChat(chatId, query) {
  try {
    const response = await axiosInstance.post(`/api/ai/${chatId}/ask`, {
      query,
    });

    return response.data?.answer || null;
  } catch {
    return null;
  }
}
