import axiosInstance from "./axiosInstance.js";

export async function fetchCurrentUserProfile() {
  const response = await axiosInstance.get("/api/users/profile");
  return response.data?.data || null;
}

export async function updateCurrentUserProfile(payload) {
  const response = await axiosInstance.put("/api/users/profile", payload);
  return response.data?.data || null;
}

export async function searchUsers(keyword) {
  const response = await axiosInstance.get(
    `/api/users/search?keyword=${encodeURIComponent(keyword.trim())}`,
  );
  return response.data || [];
}

export async function blockUser(userId, options = {}) {
  const response = await axiosInstance.post(`/api/users/block/${userId}`, options);
  return response.data || null;
}
