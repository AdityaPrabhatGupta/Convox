import { Chat, User, Message, ChatRequest } from "../models/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createOnboardingConversation } from "../services/assistantSeeder.js";
import {
  cacheDelete,
  cacheGetJson,
  cacheKeys,
  cacheSetJson,
  CACHE_TTLS,
} from "../config/redis.js";

const normalizeObjectId = (value) => String(value?._id || value || "");

const enrichDirectChat = (chat, currentUser) => {
  if (!chat || chat.isGroupChat) {
    return {
      ...chat.toObject(),
      canMessage: true,
      restrictionReason: "",
    };
  }

  if (chat.isBotChat) {
    return {
      ...chat.toObject(),
      canMessage: true,
      restrictionReason: "",
    };
  }

  const currentUserId = normalizeObjectId(currentUser?._id);
  const otherUser = chat.users.find(
    (user) => normalizeObjectId(user?._id) !== currentUserId,
  );

  const currentUserBlocked = Array.isArray(currentUser?.blockedUsers)
    ? currentUser.blockedUsers.map((id) => normalizeObjectId(id))
    : [];
  const currentUserRemoved = Array.isArray(currentUser?.removedUsers)
    ? currentUser.removedUsers.map((id) => normalizeObjectId(id))
    : [];
  const otherUserBlocked = Array.isArray(otherUser?.blockedUsers)
    ? otherUser.blockedUsers.map((id) => normalizeObjectId(id))
    : [];
  const otherUserRemoved = Array.isArray(otherUser?.removedUsers)
    ? otherUser.removedUsers.map((id) => normalizeObjectId(id))
    : [];

  const blocked =
    currentUserBlocked.includes(normalizeObjectId(otherUser?._id)) ||
    otherUserBlocked.includes(currentUserId);

  const removed =
    currentUserRemoved.includes(normalizeObjectId(otherUser?._id)) ||
    otherUserRemoved.includes(currentUserId);

  return {
    ...chat.toObject(),
    canMessage: !blocked && !removed,
    restrictionReason: blocked
      ? "You cannot message this user because one of you has blocked the other."
      : removed
        ? "You removed this friend. Send and accept a new request to message again."
        : "",
  };
};

const usersAreBlocked = (currentUser, targetUser) => {
  const currentUserBlocked = Array.isArray(currentUser?.blockedUsers)
    ? currentUser.blockedUsers.map((id) => normalizeObjectId(id))
    : [];
  const targetUserBlocked = Array.isArray(targetUser?.blockedUsers)
    ? targetUser.blockedUsers.map((id) => normalizeObjectId(id))
    : [];

  return (
    currentUserBlocked.includes(normalizeObjectId(targetUser?._id)) ||
    targetUserBlocked.includes(normalizeObjectId(currentUser?._id))
  );
};

// @desc    Create or fetch a one-to-one chat
// @route   POST /api/chats
// @access  Protected
const createOrFetchChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  //Validations
  if (!userId) {
    res.status(400);
    throw new Error("userId is required.");
  }

  if (userId === req.user._id.toString()) {
    res.status(400);
    throw new Error("You cannot start a chat with yourself.");
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    res.status(404);
    throw new Error("Target user not found.");
  }

  if (usersAreBlocked(req.user, targetUser)) {
    res.status(403);
    throw new Error("You cannot start a chat with this user.");
  }

  // Check for existing chat
  const existingChat = await Chat.findOne({
    isGroupChat: false,
    users: { $all: [req.user._id, userId] },  // cleaner than two $elemMatch
  })
    .populate("users", "name email profilePic bio lastSeen blockedUsers removedUsers isBot")
    .populate("latestMessage");

  if (existingChat) {
    return res.status(200).json({
      success: true,
      message: "Chat fetched successfully.",
      chat: enrichDirectChat(existingChat, req.user),
    });
  }

  //  Create new chat
  const created = await Chat.create({
    isGroupChat: false,
    isBotChat: targetUser.isBot || false,
    users: [req.user._id, userId],
  });

  const fullChat = await Chat.findById(created._id)
    .populate("users", "name email profilePic bio lastSeen blockedUsers removedUsers isBot");

  await Promise.all([
    cacheDelete(cacheKeys.userChats(normalizeObjectId(req.user._id))),
    cacheDelete(cacheKeys.userChats(normalizeObjectId(userId))),
  ]);

  return res.status(201).json({
    success: true,
    message: "Chat created successfully.",
    chat: enrichDirectChat(fullChat, req.user),
  });
});

// @desc    Fetch all chats for logged-in user
// @route   GET /api/chats
// @access  Protected

const fetchChats = asyncHandler(async (req, res) => {
  await createOnboardingConversation(req.user._id);
  const cacheKey = cacheKeys.userChats(normalizeObjectId(req.user._id));
  const cached = await cacheGetJson(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const chats = await Chat.find({ users: req.user._id })
    .populate("users", "name email profilePic bio lastSeen blockedUsers removedUsers isBot")
    .populate({
      path: "latestMessage",
      populate: {
        path: "sender",
        select: "name email profilePic",
      },
    })
    .sort({ updatedAt: -1 });

  for (const chat of chats) {
    const latestMessage = chat.latestMessage;
    const deletedForCurrentUser = Array.isArray(latestMessage?.deletedFor)
      ? latestMessage.deletedFor.some((userId) => normalizeObjectId(userId) === normalizeObjectId(req.user._id))
      : false;

    if (latestMessage?.isDeletedForEveryone || deletedForCurrentUser) {
      chat.latestMessage = await Message.findOne({
        chat: chat._id,
        isDeletedForEveryone: { $ne: true },
        deletedFor: { $ne: req.user._id },
      })
        .populate("sender", "name email profilePic")
        .sort({ createdAt: -1 });
    }
  }

  const currentUserBlocked = Array.isArray(req.user.blockedUsers)
    ? req.user.blockedUsers.map((id) => normalizeObjectId(id))
    : [];

  const visibleChats = chats
    .filter((chat) => {
      if (chat.isBotChat) return true;
      if (chat.isGroupChat) return true;

      const otherUser = chat.users.find(
        (user) => normalizeObjectId(user._id) !== normalizeObjectId(req.user._id),
      );

      return otherUser && !currentUserBlocked.includes(normalizeObjectId(otherUser._id));
    })
    .map((chat) => enrichDirectChat(chat, req.user));

  const payload = {
    success: true,
    count: visibleChats.length,
    chats: visibleChats,
  };

  await cacheSetJson(cacheKey, payload, CACHE_TTLS.chats);

  return res.status(200).json(payload);
});

const removeDirectChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { deleteChat = false } = req.body || {};

  const chat = await Chat.findOne({
    _id: chatId,
    isGroupChat: false,
    users: req.user._id,
  }).populate("users", "name");

  if (!chat) {
    res.status(404);
    throw new Error("Chat not found.");
  }

  const otherUser = chat.users.find(
    (user) => normalizeObjectId(user._id) !== normalizeObjectId(req.user._id),
  );

  await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { removedUsers: otherUser._id } },
  );
  await User.updateOne(
    { _id: otherUser._id },
    { $addToSet: { removedUsers: req.user._id } },
  );

  if (deleteChat) {
    await Message.deleteMany({ chat: chat._id });
    await Chat.deleteOne({ _id: chat._id });
  }

  await ChatRequest.deleteMany({
    $or: [
      { sender: req.user._id, receiver: otherUser._id },
      { sender: otherUser._id, receiver: req.user._id },
    ],
  });

  await Promise.all(
    chat.users.map((user) => cacheDelete(cacheKeys.userChats(normalizeObjectId(user._id)))),
  );

  return res.status(200).json({
    success: true,
    message: "Friend removed successfully.",
    removedChatId: chatId,
    removedUserId: otherUser?._id || null,
    deleteChat: Boolean(deleteChat),
  });
});

export { createOrFetchChat, fetchChats, removeDirectChat };
