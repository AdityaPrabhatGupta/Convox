import { Chat, User, Message } from "../models/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import { io } from "../socket/socket.js";

const normalizeId = (value) => String(value?._id || value || "");

const POPULATE_USERS =
  "name email profilePic bio lastSeen blockedUsers removedUsers isBot";

async function populateChat(chatId) {
  return Chat.findById(chatId)
    .populate("users", POPULATE_USERS)
    .populate("groupAdmin", "name email profilePic")
    .populate({
      path: "latestMessage",
      populate: { path: "sender", select: "name email profilePic" },
    });
}

export const createGroup = asyncHandler(async (req, res) => {
  const { name, memberIds = [] } = req.body;

  if (!name?.trim()) {
    res.status(400);
    throw new Error("Group name is required.");
  }

  if (!Array.isArray(memberIds) || memberIds.length < 1) {
    res.status(400);
    throw new Error("Add at least 1 member to create a group.");
  }

  if (memberIds.length > 49) {
    res.status(400);
    throw new Error("A group can have at most 50 members.");
  }

  const uniqueIds = [
    ...new Set([normalizeId(req.user._id), ...memberIds.map(String)]),
  ];

  if (uniqueIds.length < 2) {
    res.status(400);
    throw new Error("A group must have at least 2 members.");
  }

  const foundUsers = await User.find({ _id: { $in: uniqueIds } }).select("_id");
  if (foundUsers.length !== uniqueIds.length) {
    res.status(400);
    throw new Error("One or more users were not found.");
  }

  const group = await Chat.create({
    isGroupChat: true,
    groupName: name.trim(),
    groupAdmin: req.user._id,
    users: uniqueIds,
  });

  const welcomeMessage = await Message.create({
    sender: req.user._id,
    chat: group._id,
    content: `${req.user.name} created this group`,
    type: "text",
    isSystem: true,
  });

  await Chat.findByIdAndUpdate(group._id, { latestMessage: welcomeMessage._id });

  const populated = await populateChat(group._id);
  res.status(201).json({ success: true, chat: populated });
});

export const getGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const group = await Chat.findOne({
    _id: chatId,
    isGroupChat: true,
    users: req.user._id,
  })
    .populate("users", POPULATE_USERS)
    .populate("groupAdmin", "name email profilePic");

  if (!group) {
    res.status(404);
    throw new Error("Group not found.");
  }

  res.status(200).json({ success: true, chat: group });
});

export const renameGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { name } = req.body;

  if (!name?.trim()) {
    res.status(400);
    throw new Error("Group name cannot be empty.");
  }

  const group = await Chat.findOne({
    _id: chatId,
    isGroupChat: true,
    users: req.user._id,
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found.");
  }

  if (normalizeId(group.groupAdmin) !== normalizeId(req.user._id)) {
    res.status(403);
    throw new Error("Only the group admin can rename the group.");
  }

  group.groupName = name.trim();
  await group.save();

  const message = await Message.create({
    sender: req.user._id,
    chat: chatId,
    content: `${req.user.name} renamed the group to "${name.trim()}"`,
    type: "text",
    isSystem: true,
  });

  await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

  const populated = await populateChat(chatId);
  io.to(String(chatId)).emit("groupUpdated", {
    chatId: String(chatId),
    event: "renamed",
    groupName: name.trim(),
  });

  res.status(200).json({ success: true, chat: populated });
});

export const addMembers = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { memberIds = [] } = req.body;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    res.status(400);
    throw new Error("No members provided.");
  }

  const group = await Chat.findOne({
    _id: chatId,
    isGroupChat: true,
    users: req.user._id,
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found.");
  }

  if (normalizeId(group.groupAdmin) !== normalizeId(req.user._id)) {
    res.status(403);
    throw new Error("Only the group admin can add members.");
  }

  const currentIds = group.users.map((user) => normalizeId(user));
  const toAdd = [...new Set(memberIds.map(String))].filter(
    (id) => !currentIds.includes(id),
  );

  if (!toAdd.length) {
    res.status(400);
    throw new Error("All selected users are already in the group.");
  }

  if (currentIds.length + toAdd.length > 50) {
    res.status(400);
    throw new Error("Group cannot exceed 50 members.");
  }

  const newUsers = await User.find({ _id: { $in: toAdd } }).select("name");
  if (!newUsers.length) {
    res.status(404);
    throw new Error("Users not found.");
  }

  group.users.push(...toAdd);
  await group.save();

  const names = newUsers.map((user) => user.name).join(", ");
  const message = await Message.create({
    sender: req.user._id,
    chat: chatId,
    content: `${req.user.name} added ${names}`,
    type: "text",
    isSystem: true,
  });

  await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

  const populated = await populateChat(chatId);
  io.to(String(chatId)).emit("groupUpdated", {
    chatId: String(chatId),
    event: "memberAdded",
    addedIds: toAdd,
  });

  res.status(200).json({ success: true, chat: populated, addedIds: toAdd });
});

export const removeMember = asyncHandler(async (req, res) => {
  const { chatId, memberId } = req.params;

  const group = await Chat.findOne({
    _id: chatId,
    isGroupChat: true,
    users: req.user._id,
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found.");
  }

  if (normalizeId(group.groupAdmin) !== normalizeId(req.user._id)) {
    res.status(403);
    throw new Error("Only the group admin can remove members.");
  }

  if (String(memberId) === normalizeId(req.user._id)) {
    res.status(400);
    throw new Error("Admin cannot remove themselves. Transfer admin or leave the group.");
  }

  const removedUser = await User.findById(memberId).select("name");
  if (!removedUser) {
    res.status(404);
    throw new Error("User not found.");
  }

  group.users = group.users.filter((user) => normalizeId(user) !== String(memberId));
  await group.save();

  const message = await Message.create({
    sender: req.user._id,
    chat: chatId,
    content: `${req.user.name} removed ${removedUser.name}`,
    type: "text",
    isSystem: true,
  });

  await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

  const populated = await populateChat(chatId);
  io.to(String(chatId)).emit("groupUpdated", {
    chatId: String(chatId),
    event: "memberRemoved",
    removedId: String(memberId),
  });

  res.status(200).json({
    success: true,
    chat: populated,
    removedId: String(memberId),
  });
});

export const leaveGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = normalizeId(req.user._id);

  const group = await Chat.findOne({
    _id: chatId,
    isGroupChat: true,
    users: req.user._id,
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found.");
  }

  const isAdmin = normalizeId(group.groupAdmin) === userId;

  if (isAdmin) {
    const remaining = group.users.filter((user) => normalizeId(user) !== userId);

    if (!remaining.length) {
      await Message.deleteMany({ chat: chatId });
      await Chat.deleteOne({ _id: chatId });
      io.to(String(chatId)).emit("groupDissolved", { chatId: String(chatId) });
      res.status(200).json({ success: true, dissolved: true, chatId });
      return;
    }

    group.groupAdmin = remaining[0];
    group.users = remaining;
    await group.save();

    const newAdmin = await User.findById(remaining[0]).select("name");
    const message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      content: `${req.user.name} left. ${newAdmin?.name || "Another member"} is now admin.`,
      type: "text",
      isSystem: true,
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
    io.to(String(chatId)).emit("groupUpdated", {
      chatId: String(chatId),
      event: "memberLeft",
      userId,
      newAdminId: String(remaining[0]),
    });
  } else {
    group.users = group.users.filter((user) => normalizeId(user) !== userId);
    await group.save();

    const message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      content: `${req.user.name} left the group`,
      type: "text",
      isSystem: true,
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
    io.to(String(chatId)).emit("groupUpdated", {
      chatId: String(chatId),
      event: "memberLeft",
      userId,
    });
  }

  res.status(200).json({ success: true, dissolved: false, chatId });
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const group = await Chat.findOne({
    _id: chatId,
    isGroupChat: true,
    users: req.user._id,
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found.");
  }

  if (normalizeId(group.groupAdmin) !== normalizeId(req.user._id)) {
    res.status(403);
    throw new Error("Only the group admin can delete this group.");
  }

  await Message.deleteMany({ chat: chatId });
  await Chat.deleteOne({ _id: chatId });
  io.to(String(chatId)).emit("groupDissolved", { chatId: String(chatId) });

  res.status(200).json({ success: true, chatId });
});

export const transferAdmin = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { newAdminId } = req.body;

  if (!newAdminId) {
    res.status(400);
    throw new Error("newAdminId is required.");
  }

  const group = await Chat.findOne({
    _id: chatId,
    isGroupChat: true,
    users: req.user._id,
  });

  if (!group) {
    res.status(404);
    throw new Error("Group not found.");
  }

  if (normalizeId(group.groupAdmin) !== normalizeId(req.user._id)) {
    res.status(403);
    throw new Error("Only the current admin can transfer admin.");
  }

  if (!group.users.map(normalizeId).includes(String(newAdminId))) {
    res.status(400);
    throw new Error("New admin must be a member of the group.");
  }

  group.groupAdmin = newAdminId;
  await group.save();

  const newAdmin = await User.findById(newAdminId).select("name");
  const message = await Message.create({
    sender: req.user._id,
    chat: chatId,
    content: `${req.user.name} made ${newAdmin?.name || "someone"} the new admin`,
    type: "text",
    isSystem: true,
  });

  await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

  const populated = await populateChat(chatId);
  io.to(String(chatId)).emit("groupUpdated", {
    chatId: String(chatId),
    event: "adminChanged",
    newAdminId: String(newAdminId),
  });

  res.status(200).json({ success: true, chat: populated });
});
