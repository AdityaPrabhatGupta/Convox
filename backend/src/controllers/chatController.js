import Chat from "../models/chat.js";
import User from "../models/User.js";

// @desc    Create or fetch one-to-one chat
// @route   POST /api/chat
// @access  Protected
const createOrFetchChat = async (req, res) => {
  const { userId } = req.body;

  // Validate: userId must be present
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId is required",
    });
  }

  // Validate: cannot chat with yourself
  if (userId === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: "You cannot start a chat with yourself",
    });
  }

  try {
    // Validate: target user must exist in DB
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if a one-to-one chat already exists between both users
    const existingChat = await Chat.find({
      $and: [
        { isGroupChat: false },
        { users: { $elemMatch: { $eq: req.user._id } } },
        { users: { $elemMatch: { $eq: userId } } },
      ],
    })
      .populate("users", "-password")
      .populate("latestMessage");

    // Return existing chat if found
    if (existingChat.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Chat already exists",
        chat: existingChat[0],
      });
    }

    // Create new one-to-one chat
    // groupName and groupAdmin stay as schema defaults ("" and null)
    const createdChat = await Chat.create({
      users: [req.user._id, userId],
      isGroupChat: false,
    });

    // Re-fetch with populated user details (create() doesn't auto-populate)
    const fullChat = await Chat.findById(createdChat._id).populate(
      "users",
      "-password"
    );

    return res.status(201).json({
      success: true,
      message: "Chat created successfully",
      chat: fullChat,
    });
  } catch (error) {
    console.error("createOrFetchChat error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const fetchChats = async (req, res) => {
  try {
    // Step 1: Find all chats where logged-in user is a participant
    const chats = await Chat.find({ users: req.user._id })

      // Step 2: Populate all users in the chat (exclude password)
      .populate("users", "name email profilePic")

      // Step 3: Nested populate — latestMessage AND its sender
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "name email profilePic",
        },
      })

      // Step 4: Sort by most recently updated (latest message first)
      .sort({ updatedAt: -1 });

    // Step 5: Return the enriched chats list
    return res.status(200).json({
      success: true,
      count: chats.length,
      chats,
    });
  } catch (error) {
    console.error("fetchChats error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export { createOrFetchChat, fetchChats };

