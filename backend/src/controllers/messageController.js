import mongoose from "mongoose";
import { Message, Chat, User } from "../models/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import { processAndUpload } from "../services/mediaService.js";
import { io } from "../socket/socket.js";
import { getSocketIds } from "../socket/userSocketMap.js";
import { isViewingChat } from "../socket/roomTracker.js";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const normalizeId = (value) => String(value?._id || value || "");
const MEDIA_PREVIEW = {
  image: "Sent an image",
  video: "Sent a video",
  audio: "Sent an audio clip",
  file: "Sent a file",
};

const ensureChatAccess = async (chatId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const error = new Error("Invalid chatId");
    error.statusCode = 400;
    throw error;
  }

  const chat = await Chat.findOne({ _id: chatId, users: userId });
  if (!chat) {
    const error = new Error("Chat not found or access denied");
    error.statusCode = 403;
    throw error;
  }

  return chat;
};

const ensureDirectMessagingAllowed = async (chat, user) => {
  if (chat.isGroupChat) return;

  const participants = await User.find({ _id: { $in: chat.users } }).select(
    "blockedUsers removedUsers",
  );
  const senderId = normalizeId(user._id);
  const otherUser = participants.find((entry) => normalizeId(entry._id) !== senderId);

  const senderBlocked = (user.blockedUsers || []).map(normalizeId);
  const senderRemoved = (user.removedUsers || []).map(normalizeId);
  const otherBlocked = (otherUser?.blockedUsers || []).map(normalizeId);
  const otherRemoved = (otherUser?.removedUsers || []).map(normalizeId);

  if (
    senderBlocked.includes(normalizeId(otherUser?._id)) ||
    otherBlocked.includes(senderId)
  ) {
    const error = new Error(
      "Messaging is unavailable because one of you has blocked the other.",
    );
    error.statusCode = 403;
    throw error;
  }

  if (
    senderRemoved.includes(normalizeId(otherUser?._id)) ||
    otherRemoved.includes(senderId)
  ) {
    const error = new Error(
      "You cannot message this user until you become friends again.",
    );
    error.statusCode = 403;
    throw error;
  }
};

const populateMessageById = async (messageId) =>
  Message.findById(messageId)
    .populate("sender", "name email profilePic")
    .populate("reactions.user", "name email profilePic")
    .populate({
      path: "replyTo",
      select: "content type fileName mediaUrl isDeletedForEveryone sender createdAt",
      populate: {
        path: "sender",
        select: "name email profilePic",
      },
    })
    .populate({
      path: "chat",
      populate: {
        path: "users",
        select: "name email profilePic",
      },
    });

const refreshChatLatestMessage = async (chatId) => {
  const latestMessage = await Message.findOne({
    chat: chatId,
    isDeletedForEveryone: { $ne: true },
  }).sort({ createdAt: -1 });

  await Chat.findByIdAndUpdate(chatId, {
    latestMessage: latestMessage?._id || null,
  });
};

const buildMessagePreview = (message) => {
  if (message.type && message.type !== "text") {
    return MEDIA_PREVIEW[message.type] || "Sent an attachment";
  }

  return String(message.content || "").slice(0, 60);
};

const buildMediaContentFallback = ({ type, fileName }) =>
  fileName?.trim() || MEDIA_PREVIEW[type] || "Sent an attachment";

const emitMessageCreated = (savedMessage) => {
  const chatId = normalizeId(savedMessage.chat?._id || savedMessage.chat);
  if (!chatId) return;

  io.to(chatId).emit("messageReceived", {
    _id: savedMessage._id,
    content: savedMessage.content,
    createdAt: savedMessage.createdAt,
    chat: savedMessage.chat,
    chatId,
    sender: savedMessage.sender,
    senderId: normalizeId(savedMessage.sender),
    senderName: savedMessage.sender?.name,
    participantIds: Array.isArray(savedMessage.chat?.users)
      ? savedMessage.chat.users.map((user) => normalizeId(user))
      : [],
    type: savedMessage.type || "text",
    mediaUrl: savedMessage.mediaUrl || null,
    fileName: savedMessage.fileName || null,
    fileSize: savedMessage.fileSize || null,
    mimeType: savedMessage.mimeType || null,
    replyTo: savedMessage.replyTo || null,
    forwardedFrom: savedMessage.forwardedFrom || null,
  });

  const participantIds = Array.isArray(savedMessage.chat?.users)
    ? savedMessage.chat.users.map((user) => normalizeId(user))
    : [];
  const senderId = normalizeId(savedMessage.sender);

  participantIds.forEach((participantId) => {
    if (!participantId || participantId === senderId) return;

    getSocketIds(participantId).forEach((socketId) => {
      if (isViewingChat(socketId, chatId)) return;

      io.to(socketId).emit("new_notification", {
        chatId,
        senderId,
        senderName: savedMessage.sender?.name || "Someone",
        preview: buildMessagePreview(savedMessage),
        timestamp: savedMessage.createdAt,
      });
    });
  });
};

const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId, replyTo } = req.body;

  if (!content || !chatId) {
    res.status(400);
    throw new Error("Content and chatId are required");
  }

  const chat = await ensureChatAccess(chatId, req.user._id);
  await ensureDirectMessagingAllowed(chat, req.user);

  let replyMessage = null;
  if (replyTo) {
    replyMessage = await Message.findOne({
      _id: replyTo,
      chat: chatId,
      deletedFor: { $ne: req.user._id },
    });

    if (!replyMessage || replyMessage.isDeletedForEveryone) {
      res.status(400);
      throw new Error("The message you are replying to is unavailable.");
    }
  }

  const created = await Message.create({
    sender: req.user._id,
    content: content.trim(),
    chat: chatId,
    replyTo: replyMessage?._id || null,
  });

  const newMessage = await populateMessageById(created._id);
  await Chat.findByIdAndUpdate(chatId, { latestMessage: newMessage._id });
  emitMessageCreated(newMessage);

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: newMessage,
  });
});

const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file provided");
  }

  const { chatId, replyTo } = req.body;
  if (!chatId) {
    res.status(400);
    throw new Error("chatId is required");
  }

  const chat = await ensureChatAccess(chatId, req.user._id);
  await ensureDirectMessagingAllowed(chat, req.user);

  const { type, mediaUrl, fileName, fileSize, mimeType } = await processAndUpload(
    req.file,
  );

  let replyMessage = null;
  if (replyTo) {
    replyMessage = await Message.findOne({
      _id: replyTo,
      chat: chatId,
      deletedFor: { $ne: req.user._id },
    });

    if (!replyMessage || replyMessage.isDeletedForEveryone) {
      res.status(400);
      throw new Error("The message you are replying to is unavailable.");
    }
  }

  const created = await Message.create({
    sender: req.user._id,
    chat: chatId,
    type,
    content: buildMediaContentFallback({ type, fileName }),
    mediaUrl,
    fileName,
    fileSize,
    mimeType,
    replyTo: replyMessage?._id || null,
  });

  const populated = await populateMessageById(created._id);
  await Chat.findByIdAndUpdate(chatId, { latestMessage: populated._id });
  emitMessageCreated(populated);

  res.status(201).json({
    success: true,
    message: "Media uploaded successfully",
    data: populated,
  });
});

const allMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  await ensureChatAccess(chatId, req.user._id);

  const requestedLimit = Number(req.query.limit || 30);
  const limit = Math.min(Math.max(requestedLimit, 1), 100);
  const before = req.query.before ? new Date(req.query.before) : null;
  const createdAtFilter =
    before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {};

  const messages = await Message.find({
    chat: chatId,
    deletedFor: { $ne: req.user._id },
    ...createdAtFilter,
  })
    .populate("sender", "name profilePic email")
    .populate("reactions.user", "name email profilePic")
    .populate({
      path: "replyTo",
      select: "content type fileName mediaUrl isDeletedForEveryone sender createdAt",
      populate: {
        path: "sender",
        select: "name email profilePic",
      },
    })
    .populate("chat")
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const pageItems = hasMore ? messages.slice(0, limit) : messages;
  const orderedMessages = pageItems.reverse();
  const nextCursor =
    hasMore && pageItems.length ? pageItems[pageItems.length - 1].createdAt : null;

  res.status(200).json({
    success: true,
    data: orderedMessages,
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  });
});

const toggleReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;

  if (!emoji) {
    res.status(400);
    throw new Error("Emoji is required");
  }

  const message = await Message.findById(messageId).populate("chat");
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }

  await ensureChatAccess(message.chat._id, req.user._id);

  const userId = normalizeId(req.user._id);
  const existingIndex = message.reactions.findIndex(
    (reaction) => normalizeId(reaction.user) === userId && reaction.emoji === emoji,
  );

  if (existingIndex >= 0) {
    message.reactions.splice(existingIndex, 1);
  } else {
    message.reactions = message.reactions.filter(
      (reaction) => normalizeId(reaction.user) !== userId || reaction.emoji !== emoji,
    );
    message.reactions.push({ emoji, user: req.user._id });
  }

  await message.save();
  const populated = await populateMessageById(message._id);

  const reactionChatId = normalizeId(message.chat._id);
  io.to(reactionChatId).emit("reactionUpdated", populated);

  res.status(200).json({ success: true, data: populated });
});

const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    res.status(400);
    throw new Error("Edited content is required");
  }

  const message = await Message.findById(messageId).populate("chat");
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }

  await ensureChatAccess(message.chat._id, req.user._id);

  if (normalizeId(message.sender) !== normalizeId(req.user._id)) {
    res.status(403);
    throw new Error("You can only edit your own messages");
  }

  if (message.isDeletedForEveryone) {
    res.status(400);
    throw new Error("Deleted messages cannot be edited");
  }

  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
    res.status(400);
    throw new Error("Messages can only be edited within 15 minutes");
  }

  message.content = content.trim();
  message.editedAt = new Date();
  await message.save();

  const populated = await populateMessageById(message._id);
  await Chat.findByIdAndUpdate(message.chat._id, { latestMessage: message._id });

  const editChatId = normalizeId(message.chat._id);
  io.to(editChatId).emit("messageEdited", populated);

  res.status(200).json({ success: true, data: populated });
});

const deleteForMe = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const message = await Message.findById(messageId).populate("chat");
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }

  await ensureChatAccess(message.chat._id, req.user._id);

  await Message.updateOne(
    { _id: messageId },
    { $addToSet: { deletedFor: req.user._id } },
  );

  res.status(200).json({ success: true, messageId });
});

const deleteForEveryone = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const message = await Message.findById(messageId).populate("chat");
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }

  await ensureChatAccess(message.chat._id, req.user._id);

  if (normalizeId(message.sender) !== normalizeId(req.user._id)) {
    res.status(403);
    throw new Error("You can only delete your own messages for everyone");
  }

  await Message.updateOne(
    { _id: messageId },
    {
      $set: {
        content: "",
        isDeletedForEveryone: true,
        editedAt: null,
        pinnedAt: null,
        reactions: [],
      },
    },
  );
  await refreshChatLatestMessage(message.chat._id);

  const populated = await populateMessageById(message._id);

  const deleteChatId = normalizeId(message.chat._id);
  io.to(deleteChatId).emit("messageDeleted", populated);

  res.status(200).json({ success: true, data: populated });
});

const togglePinMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const message = await Message.findById(messageId).populate("chat");
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }

  await ensureChatAccess(message.chat._id, req.user._id);

  if (message.isDeletedForEveryone) {
    res.status(400);
    throw new Error("Deleted messages cannot be pinned");
  }

  message.pinnedAt = message.pinnedAt ? null : new Date();
  await message.save();

  const populated = await populateMessageById(message._id);
  res.status(200).json({ success: true, data: populated });
});

const forwardMessages = asyncHandler(async (req, res) => {
  const { messageIds = [], targetChatIds = [] } = req.body;

  if (!Array.isArray(messageIds) || !messageIds.length || !Array.isArray(targetChatIds) || !targetChatIds.length) {
    res.status(400);
    throw new Error("messageIds and targetChatIds are required");
  }

  const sourceMessages = await Message.find({
    _id: { $in: messageIds },
    deletedFor: { $ne: req.user._id },
  }).populate("sender", "name");

  if (!sourceMessages.length) {
    res.status(404);
    throw new Error("No messages available to forward");
  }

  const accessibleChats = await Chat.find({
    _id: { $in: targetChatIds },
    users: req.user._id,
  });

  if (!accessibleChats.length) {
    res.status(403);
    throw new Error("No valid target chats found");
  }

  const createdMessages = [];

  for (const chat of accessibleChats) {
    await ensureDirectMessagingAllowed(chat, req.user);

    for (const source of sourceMessages) {
      if (source.isDeletedForEveryone) continue;

      const created = await Message.create({
        sender: req.user._id,
        content: source.content,
        chat: chat._id,
        type: source.type || "text",
        mediaUrl: source.mediaUrl || null,
        fileName: source.fileName || null,
        fileSize: source.fileSize || null,
        mimeType: source.mimeType || null,
        forwardedFrom: {
          messageId: source._id,
          senderName: source.sender?.name || "",
        },
      });

      await Chat.findByIdAndUpdate(chat._id, { latestMessage: created._id });
      const populated = await populateMessageById(created._id);
      createdMessages.push(populated);
      emitMessageCreated(populated);
    }
  }

  res.status(201).json({ success: true, data: createdMessages });
});

const clearChatMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  await ensureChatAccess(chatId, req.user._id);

  await Message.updateMany(
    { chat: chatId, deletedFor: { $ne: req.user._id } },
    { $addToSet: { deletedFor: req.user._id } },
  );
  await refreshChatLatestMessage(chatId);

  res.status(200).json({ success: true, message: "Chat cleared successfully" });
});

export {
  allMessages,
  clearChatMessages,
  deleteForEveryone,
  deleteForMe,
  editMessage,
  forwardMessages,
  sendMessage,
  uploadMedia,
  togglePinMessage,
  toggleReaction,
};
