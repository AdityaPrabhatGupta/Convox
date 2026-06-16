import mongoose from "mongoose";
import { Chat, Message } from "../models/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import { io } from "../socket/socket.js";
import { getAssistantUserId } from "../services/assistantSeeder.js";
import logger from "../config/logger.js";
import {
  contextualAnswer,
  getAssistantReply,
  getSmartReplies,
  summarizeChat,
} from "../services/aiService.js";

const ASSISTANT_MSG_LIMIT = 10;
const ASSISTANT_WINDOW_MS = 24 * 60 * 60 * 1000;
const ASSISTANT_WARN_REMAINING = 1;

async function getBotChat(chatId, userId) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const error = new Error("Invalid chatId");
    error.statusCode = 400;
    throw error;
  }

  const chat = await Chat.findOne({
    _id: chatId,
    isBotChat: true,
    users: userId,
  });

  if (!chat) {
    const error = new Error("Assistant chat not found or access denied");
    error.statusCode = 403;
    throw error;
  }

  return chat;
}

async function getReadableChat(chatId, userId) {
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
}

async function countUserMessagesLifetime(chatId, userId) {
  return Message.countDocuments({
    chat: chatId,
    sender: userId,
    isSystem: { $ne: true },
    isDeletedForEveryone: { $ne: true },
  });
}

async function findLatestUserMessage(chatId, userId) {
  return Message.findOne({
    chat: chatId,
    sender: userId,
    isSystem: { $ne: true },
    isDeletedForEveryone: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();
}

function buildAssistantStatus(count, resetAt) {
  const messagesRemaining = Math.max(0, ASSISTANT_MSG_LIMIT - count);

  return {
    messagesUsed: count,
    messagesRemaining,
    limit: ASSISTANT_MSG_LIMIT,
    limitReached: messagesRemaining === 0,
    warnUser: messagesRemaining === ASSISTANT_WARN_REMAINING,
    refreshesAt: resetAt,
  };
}

async function normalizeAssistantQuota(chat, userId) {
  const now = Date.now();
  const resetAtMs = chat.assistantQuotaResetAt
    ? new Date(chat.assistantQuotaResetAt).getTime()
    : null;

  if (resetAtMs && now >= resetAtMs) {
    await Chat.updateOne(
      { _id: chat._id },
      {
        $set: {
          assistantQuotaCount: 0,
          assistantQuotaResetAt: null,
        },
      },
    );
    return {
      count: 0,
      resetAt: null,
    };
  }

  if (
    typeof chat.assistantQuotaCount === "number" &&
    Number.isFinite(chat.assistantQuotaCount)
  ) {
    return {
      count: chat.assistantQuotaCount,
      resetAt: resetAtMs,
    };
  }

  const [lifetimeCount, latestUserMessage] = await Promise.all([
    countUserMessagesLifetime(chat._id, userId),
    findLatestUserMessage(chat._id, userId),
  ]);

  let normalizedCount = lifetimeCount;
  let normalizedResetAt = null;

  if (lifetimeCount >= ASSISTANT_MSG_LIMIT && latestUserMessage) {
    const latestMessageTime = new Date(latestUserMessage.createdAt).getTime();
    const derivedResetAt = latestMessageTime + ASSISTANT_WINDOW_MS;

    if (derivedResetAt > now) {
      normalizedCount = ASSISTANT_MSG_LIMIT;
      normalizedResetAt = derivedResetAt;
    } else {
      normalizedCount = 0;
    }
  }

  await Chat.updateOne(
    { _id: chat._id },
    {
      $set: {
        assistantQuotaCount: normalizedCount,
        assistantQuotaResetAt: normalizedResetAt
          ? new Date(normalizedResetAt)
          : null,
      },
    },
  );

  return {
    count: normalizedCount,
    resetAt: normalizedResetAt,
  };
}

const populateMessage = (messageId) =>
  Message.findById(messageId)
    .populate("sender", "name email profilePic isBot")
    .populate({
      path: "chat",
      populate: { path: "users", select: "name email profilePic isBot" },
    });

export const sendAssistantMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    res.status(400);
    throw new Error("Message content is required");
  }

  const chat = await getBotChat(chatId, req.user._id);

  if (req.body.type && req.body.type !== "text") {
    res.status(403);
    throw new Error("Only text messages are allowed in the assistant chat");
  }

  const { count: userMsgCount, resetAt } = await normalizeAssistantQuota(
    chat,
    req.user._id,
  );

  if (userMsgCount >= ASSISTANT_MSG_LIMIT) {
    const msLeft = Math.max(0, (resetAt || Date.now()) - Date.now());
    const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor(
      (msLeft % (1000 * 60 * 60)) / (1000 * 60),
    );

    return res.status(429).json({
      success: false,
      message: `You've used all 10 daily messages. Your quota refreshes in ${hoursLeft}h ${minutesLeft}m.`,
      ...buildAssistantStatus(userMsgCount, resetAt),
    });
  }

  const created = await Message.create({
    sender: req.user._id,
    chat: chatId,
    content: content.trim(),
    type: "text",
  });

  const userMessage = await populateMessage(created._id);
  await Chat.findByIdAndUpdate(chatId, { latestMessage: userMessage._id });

  io.to(chatId).emit("messageReceived", {
    _id: userMessage._id,
    content: userMessage.content,
    createdAt: userMessage.createdAt,
    chat: userMessage.chat,
    chatId,
    sender: userMessage.sender,
    senderId: String(userMessage.sender._id),
    type: "text",
    isSystem: false,
    participantIds: chat.users.map(String),
  });

  const newCount = userMsgCount + 1;
  const quotaResetAt =
    newCount >= ASSISTANT_MSG_LIMIT
      ? new Date(created.createdAt).getTime() + ASSISTANT_WINDOW_MS
      : null;

  await Chat.updateOne(
    { _id: chat._id },
    {
      $set: {
        assistantQuotaCount: newCount,
        assistantQuotaResetAt: quotaResetAt ? new Date(quotaResetAt) : null,
      },
    },
  );

  res.status(201).json({
    success: true,
    data: userMessage,
    ...buildAssistantStatus(newCount, quotaResetAt),
  });

  logger.info("Assistant message accepted", {
    chatId: String(chatId),
    userId: String(req.user._id),
    quotaUsed: newCount,
  });

  setImmediate(() => {
    io.to(chatId).emit("assistantTyping", { chatId });
  });

  setImmediate(async () => {
    try {
      const assistantId = getAssistantUserId();
      if (!assistantId) {
        logger.warn("Assistant reply skipped because assistant user is unavailable", {
          chatId: String(chatId),
          userId: String(req.user._id),
        });
        io.to(chatId).emit("assistantTypingStop", { chatId });
        return;
      }

      const aiReply = await getAssistantReply(content.trim());

      const botMessage = await Message.create({
        sender: assistantId,
        chat: chatId,
        content: aiReply,
        type: "text",
        isSystem: true,
      });

      const populated = await populateMessage(botMessage._id);
      await Chat.findByIdAndUpdate(chatId, { latestMessage: botMessage._id });

      io.to(chatId).emit("messageReceived", {
        _id: populated._id,
        content: populated.content,
        createdAt: populated.createdAt,
        chat: populated.chat,
        chatId,
        sender: populated.sender,
        senderId: String(populated.sender._id),
        type: "text",
        isSystem: true,
        participantIds: chat.users.map(String),
      });
    } catch (error) {
      logger.error("Assistant AI reply failed", {
        chatId: String(chatId),
        userId: String(req.user._id),
        error: error.message,
      });
    } finally {
      io.to(chatId).emit("assistantTypingStop", { chatId });
    }
  });
});

export const getAssistantStatus = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const chat = await getBotChat(chatId, req.user._id);

  const { count, resetAt } = await normalizeAssistantQuota(chat, req.user._id);

  res.json({
    success: true,
    ...buildAssistantStatus(count, resetAt),
  });
});

export const getSmartRepliesHandler = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  await getReadableChat(chatId, req.user._id);

  const recentMessages = await Message.find({
    chat: chatId,
    isDeletedForEveryone: { $ne: true },
    type: "text",
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("sender", "name");

  const formatted = recentMessages.reverse().map((message) => ({
    content: message.content,
    senderName: message.sender?.name || "User",
  }));

  const replies = await getSmartReplies(formatted);
  res.json({ success: true, replies });
});

export const summarizeChatHandler = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  await getReadableChat(chatId, req.user._id);

  const recentMessages = await Message.find({
    chat: chatId,
    isDeletedForEveryone: { $ne: true },
    type: "text",
  })
    .sort({ createdAt: -1 })
    .limit(25)
    .populate("sender", "name");

  if (recentMessages.length < 3) {
    return res.json({
      success: true,
      summary: "Not enough messages to summarize yet.",
    });
  }

  const formatted = recentMessages.reverse().map((message) => ({
    content: message.content,
    senderName: message.sender?.name || "User",
  }));

  const summary = await summarizeChat(formatted);

  res.json({
    success: true,
    summary: summary || "Could not generate a summary right now. Please try again.",
  });
});

export const contextualAnswerHandler = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { query } = req.body;

  if (!query?.trim()) {
    res.status(400);
    throw new Error("Query is required");
  }

  await getReadableChat(chatId, req.user._id);

  const recentMessages = await Message.find({
    chat: chatId,
    isDeletedForEveryone: { $ne: true },
    type: "text",
  })
    .sort({ createdAt: -1 })
    .limit(15)
    .populate("sender", "name");

  const formatted = recentMessages.reverse().map((message) => ({
    content: message.content,
    senderName: message.sender?.name || "User",
  }));

  const answer = await contextualAnswer(query.trim(), formatted);
  res.json({ success: true, answer });
});
