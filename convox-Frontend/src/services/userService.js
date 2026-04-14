import axiosInstance from "./axiosInstance.js";

export async function fetchCurrentUserProfile() {
  const response = await axiosInstance.get("/api/users/profile");
  return response.data?.data || null;
}
