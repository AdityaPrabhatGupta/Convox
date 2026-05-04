import axiosInstance from "./axiosInstance.js";

export async function createGroup(name, memberIds) {
  const response = await axiosInstance.post("/api/groups", { name, memberIds });
  return response.data?.chat || null;
}

export async function getGroup(chatId) {
  const response = await axiosInstance.get(`/api/groups/${chatId}`);
  return response.data?.chat || null;
}

export async function renameGroup(chatId, name) {
  const response = await axiosInstance.patch(`/api/groups/${chatId}/name`, { name });
  return response.data?.chat || null;
}

export async function addGroupMembers(chatId, memberIds) {
  const response = await axiosInstance.post(`/api/groups/${chatId}/members`, {
    memberIds,
  });
  return response.data || null;
}

export async function removeGroupMember(chatId, memberId) {
  const response = await axiosInstance.delete(`/api/groups/${chatId}/members/${memberId}`);
  return response.data || null;
}

export async function leaveGroup(chatId) {
  const response = await axiosInstance.post(`/api/groups/${chatId}/leave`);
  return response.data || null;
}

export async function deleteGroup(chatId) {
  const response = await axiosInstance.delete(`/api/groups/${chatId}`);
  return response.data || null;
}

export async function transferAdmin(chatId, newAdminId) {
  const response = await axiosInstance.patch(`/api/groups/${chatId}/admin`, {
    newAdminId,
  });
  return response.data?.chat || null;
}
