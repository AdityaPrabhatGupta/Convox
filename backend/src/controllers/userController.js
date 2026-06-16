import mongoose from "mongoose";
import { User, Chat, Message, ChatRequest } from "../models/index.js";
import { cacheDelete, cacheKeys } from "../config/redis.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../config/logger.js";

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profilePic: user.profilePic,
  bio: user.bio || "",
  lastSeen: user.lastSeen || null,
  removedUsers: user.removedUsers || [],
  createdAt: user.createdAt,
});

const normalizeObjectId = (value) => String(value?._id || value || "");

const ensureValidObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.statusCode = 400;
    throw error;
  }
};

const removeRelationshipArtifacts = async (userId, targetUserId) => {
  const directChat = await Chat.findOne({
    isGroupChat: false,
    users: { $all: [userId, targetUserId] },
  });

  if (directChat) {
    await Message.deleteMany({ chat: directChat._id });
    await Chat.deleteOne({ _id: directChat._id });
  }

  await ChatRequest.deleteMany({
    $or: [
      { sender: userId, receiver: targetUserId },
      { sender: targetUserId, receiver: userId },
    ],
  });
};

export const searchUsers = asyncHandler(async (req, res) => {
  const { keyword } = req.query;
  const currentUserId = req.user._id;

  if (!keyword || keyword.trim() === "") {
    res.status(200).json([]);
    return;
  }

  const regex = new RegExp(keyword.trim(), "i");
  const blockedByCurrentUser = Array.isArray(req.user.blockedUsers)
    ? req.user.blockedUsers.map((id) => normalizeObjectId(id))
    : [];

  const users = await User.find({
    _id: { $nin: [currentUserId, ...blockedByCurrentUser] },
    blockedUsers: { $ne: currentUserId },
    isBot: { $ne: true },
    $or: [{ name: regex }, { email: regex }],
  })
    .select("_id name email profilePic bio lastSeen")
    .limit(10);

  res.status(200).json(users);
});

export const updateUserProfile = asyncHandler(async (req, res) => {
  const { name, profilePic, bio } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  const trimmedName = String(name || "").trim();
  const trimmedBio = String(bio || "").trim();

  if (trimmedName.length < 2 || trimmedName.length > 50) {
    res.status(400);
    throw new Error("Name must be between 2 and 50 characters.");
  }

  if (trimmedBio.length > 30) {
    res.status(400);
    throw new Error("Bio cannot exceed 30 characters.");
  }

  user.name = trimmedName;
  user.bio = trimmedBio;
  user.profilePic = profilePic || null;

  await user.save();
  await cacheDelete(cacheKeys.userProfile(normalizeObjectId(user._id)));
  await cacheDelete(cacheKeys.userChats(normalizeObjectId(user._id)));

  logger.info("User profile updated", { userId: normalizeObjectId(user._id) });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: sanitizeUser(user),
  });
});

export const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { deleteChat = false } = req.body || {};
  const currentUserId = normalizeObjectId(req.user._id);

  ensureValidObjectId(userId, "user id");

  if (normalizeObjectId(userId) === currentUserId) {
    res.status(400);
    throw new Error("Invalid user to block.");
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    res.status(404);
    throw new Error("User not found.");
  }

  const alreadyBlocked = (req.user.blockedUsers || []).some(
    (blockedId) => normalizeObjectId(blockedId) === normalizeObjectId(userId),
  );

  if (!alreadyBlocked) {
    await User.updateOne(
      { _id: req.user._id },
      {
        $addToSet: {
          blockedUsers: targetUser._id,
          removedUsers: targetUser._id,
        },
      },
    );
  }

  await User.updateOne(
    { _id: targetUser._id },
    { $addToSet: { removedUsers: req.user._id } },
  );

  if (deleteChat) {
    await removeRelationshipArtifacts(req.user._id, targetUser._id);
  } else {
    await ChatRequest.deleteMany({
      $or: [
        { sender: req.user._id, receiver: targetUser._id },
        { sender: targetUser._id, receiver: req.user._id },
      ],
    });
  }

  await Promise.all([
    cacheDelete(cacheKeys.userChats(currentUserId)),
    cacheDelete(cacheKeys.userChats(normalizeObjectId(targetUser._id))),
  ]);

  logger.info("User blocked", {
    userId: currentUserId,
    blockedUserId: normalizeObjectId(targetUser._id),
    deleteChat: Boolean(deleteChat),
  });

  res.status(200).json({
    success: true,
    message: "User blocked successfully.",
    blockedUserId: targetUser._id,
    deleteChat: Boolean(deleteChat),
  });
});
