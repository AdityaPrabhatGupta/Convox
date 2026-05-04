import mongoose from "mongoose";
import { ChatRequest, Chat, User } from "../models/index.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../config/logger.js";
import { cacheDelete, cacheKeys } from "../config/redis.js";

const normalizeId = (value) => String(value?._id || value || "");

const ensureValidObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.statusCode = 400;
    throw error;
  }
};

const populateChatById = async (chatId) =>
  Chat.findById(chatId)
    .populate("users", "name email profilePic")
    .populate({
      path: "latestMessage",
      populate: {
        path: "sender",
        select: "name email profilePic",
      },
    });

const findDirectChat = async (firstUserId, secondUserId) =>
  Chat.findOne({
    isGroupChat: false,
    users: { $all: [firstUserId, secondUserId] },
  });

const populateRequestById = async (requestId) =>
  ChatRequest.findById(requestId)
    .populate("sender", "name email profilePic")
    .populate("receiver", "name email profilePic");

const invalidateRequestParticipants = async (...userIds) => {
  await Promise.all(userIds.map((userId) => cacheDelete(cacheKeys.userChats(normalizeId(userId)))));
};

const findOwnedRequest = async (requestId, ownerField, ownerId) => {
  ensureValidObjectId(requestId, "request id");

  const request = await ChatRequest.findById(requestId);
  if (!request) {
    const error = new Error("Request not found.");
    error.statusCode = 404;
    throw error;
  }

  if (normalizeId(request[ownerField]) !== normalizeId(ownerId)) {
    const error = new Error("Unauthorized.");
    error.statusCode = 403;
    throw error;
  }

  return request;
};

export const sendChatRequest = asyncHandler(async (req, res) => {
  const senderId = req.user._id;
  const { receiverId } = req.body;

  if (!receiverId) {
    res.status(400);
    throw new Error("receiverId is required.");
  }

  ensureValidObjectId(receiverId, "receiver id");

  if (normalizeId(senderId) === normalizeId(receiverId)) {
    res.status(400);
    throw new Error("You cannot send a request to yourself.");
  }

  const receiver = await User.findById(receiverId).select("_id blockedUsers removedUsers");
  if (!receiver) {
    res.status(404);
    throw new Error("Receiver not found.");
  }

  const existingChat = await findDirectChat(senderId, receiverId);
  if (existingChat) {
    res.status(400);
    throw new Error("You are already in a chat with this user.");
  }

  const senderBlocked = (req.user.blockedUsers || []).map(normalizeId);
  const receiverBlocked = (receiver.blockedUsers || []).map(normalizeId);
  if (
    senderBlocked.includes(normalizeId(receiverId)) ||
    receiverBlocked.includes(normalizeId(senderId))
  ) {
    res.status(403);
    throw new Error("You cannot send a request to this user.");
  }

  try {
    const request = await ChatRequest.create({
      sender: senderId,
      receiver: receiverId,
    });

    const populatedRequest = await populateRequestById(request._id);
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newChatRequest", populatedRequest);
    }

    logger.info("Chat request sent", {
      senderId: normalizeId(senderId),
      receiverId: normalizeId(receiverId),
      requestId: normalizeId(request._id),
    });

    res.status(201).json({
      success: true,
      message: "Chat request sent.",
      request: populatedRequest,
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400);
      throw new Error("Chat request already pending.");
    }

    throw error;
  }
});

export const getIncomingRequests = asyncHandler(async (req, res) => {
  const requests = await ChatRequest.find({
    receiver: req.user._id,
    status: "pending",
  })
    .populate("sender", "name email profilePic")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    requests,
  });
});

export const getPendingRequests = getIncomingRequests;

export const getOutgoingRequests = asyncHandler(async (req, res) => {
  const requests = await ChatRequest.find({
    sender: req.user._id,
  })
    .populate("receiver", "name email profilePic")
    .sort({ updatedAt: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    requests,
  });
});

export const acceptChatRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.requestId || req.body.requestId;
  if (!requestId) {
    res.status(400);
    throw new Error("requestId is required.");
  }

  const request = await findOwnedRequest(requestId, "receiver", req.user._id);

  if (request.status !== "pending") {
    res.status(400);
    throw new Error(`Request already ${request.status}.`);
  }

  request.status = "accepted";
  await request.save();

  await Promise.all([
    User.updateOne({ _id: request.sender }, { $pull: { removedUsers: request.receiver } }),
    User.updateOne({ _id: request.receiver }, { $pull: { removedUsers: request.sender } }),
  ]);

  const populatedRequest = await populateRequestById(request._id);
  let chat = await findDirectChat(request.sender, request.receiver);

  if (!chat) {
    chat = await Chat.create({
      isGroupChat: false,
      users: [request.sender, request.receiver],
    });
  }

  const fullChat = await populateChatById(chat._id);
  await invalidateRequestParticipants(request.sender, request.receiver);

  const senderSocketId = getReceiverSocketId(normalizeId(request.sender));
  if (senderSocketId) {
    io.to(senderSocketId).emit("chatRequestAccepted", { chat: fullChat });
    io.to(senderSocketId).emit("chatRequestStatusChanged", {
      request: populatedRequest,
      chat: fullChat,
    });
    io.to(senderSocketId).emit("request_accepted", {
      message: "Your chat request was accepted!",
      request: populatedRequest,
      chat: fullChat,
    });
  }

  logger.info("Chat request accepted", {
    requestId: normalizeId(request._id),
    senderId: normalizeId(request.sender),
    receiverId: normalizeId(request.receiver),
    chatId: normalizeId(fullChat?._id),
  });

  res.status(200).json({
    success: true,
    message: "Chat request accepted.",
    chat: fullChat,
    request: populatedRequest,
  });
});

export const rejectChatRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.requestId || req.body.requestId;
  if (!requestId) {
    res.status(400);
    throw new Error("requestId is required.");
  }

  const request = await findOwnedRequest(requestId, "receiver", req.user._id);

  if (request.status !== "pending") {
    res.status(400);
    throw new Error(`Request already ${request.status}.`);
  }

  request.status = "rejected";
  await request.save();

  const populatedRequest = await populateRequestById(request._id);
  const senderSocketId = getReceiverSocketId(normalizeId(request.sender));
  if (senderSocketId) {
    io.to(senderSocketId).emit("chatRequestStatusChanged", {
      request: populatedRequest,
    });
    io.to(senderSocketId).emit("request_rejected", {
      message: "Your chat request was rejected.",
      request: populatedRequest,
    });
  }

  logger.info("Chat request rejected", {
    requestId: normalizeId(request._id),
    senderId: normalizeId(request.sender),
    receiverId: normalizeId(request.receiver),
  });

  res.status(200).json({
    success: true,
    message: "Chat request rejected.",
    request: populatedRequest,
  });
});

export const cancelChatRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  if (!requestId) {
    res.status(400);
    throw new Error("requestId is required.");
  }

  const request = await findOwnedRequest(requestId, "sender", req.user._id);

  if (request.status !== "pending") {
    res.status(400);
    throw new Error("Only pending requests can be cancelled.");
  }

  await request.deleteOne();

  logger.info("Chat request cancelled", {
    requestId: normalizeId(request._id),
    senderId: normalizeId(request.sender),
    receiverId: normalizeId(request.receiver),
  });

  res.status(200).json({
    success: true,
    message: "Chat request cancelled.",
  });
});
