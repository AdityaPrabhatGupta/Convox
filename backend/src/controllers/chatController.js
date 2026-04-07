import Chat from "../models/Chat.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";


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

  // Check for existing chat
  const existingChat = await Chat.findOne({
    isGroupChat: false,
    users: { $all: [req.user._id, userId] },  // cleaner than two $elemMatch
  })
    .populate("users", "-password")
    .populate("latestMessage");

  if (existingChat) {
    return res.status(200).json({
      success: true,
      message: "Chat fetched successfully.",
      chat: existingChat,
    });
  }

  //  Create new chat
  const created = await Chat.create({
    isGroupChat: false,
    users: [req.user._id, userId],
  });

  const fullChat = await Chat.findById(created._id)
    .populate("users", "-password");

  return res.status(201).json({
    success: true,
    message: "Chat created successfully.",
    chat: fullChat,
  });
});

// @desc    Fetch all chats for logged-in user
// @route   GET /api/chats
// @access  Protected

const fetchChats = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ users: req.user._id })
    .populate("users", "name email profilePic")
    .populate({
      path: "latestMessage",
      populate: {
        path: "sender",
        select: "name email profilePic",
      },
    })
    .sort({ updatedAt: -1 });

  return res.status(200).json({
    success: true,
    count: chats.length,
    chats,
  });
});

export { createOrFetchChat, fetchChats };