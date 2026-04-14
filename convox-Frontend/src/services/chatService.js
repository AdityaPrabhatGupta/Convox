import axiosInstance from "./axiosInstance.js";

export async function fetchChats() {
  const response = await axiosInstance.get("/api/chat");
  return response.data?.chats || [];
}
