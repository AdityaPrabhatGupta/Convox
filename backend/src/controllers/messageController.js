import Message from '../models/message.js';
import Chat from '../models/chat.js';
import asyncHandler from "express-async-handler";

// POST /api/messages
const sendMessage = async (req, res) => {
    try {
        const { content, chatId } = req.body;

        // 1. Validate Input
        if (!content || !chatId) {
            return res.status(400).json({
                success: false,
                message: 'Content and chatId are required',
            });
        }

        // 2. Create new message in DB
        let newMessage = await Message.create({
            sender: req.user._id,    // from auth middleware
            content: content.trim(),
            chat: chatId,
        });

        // 3. Populate sender and chat details
        newMessage = await newMessage.populate('sender', 'name email profilePic');
        newMessage = await newMessage.populate({
            path: 'chat',
            populate: {
                path: 'users',         // populate users inside chat too
                select: 'name email profilePic',
            },
        });

        // 4. Update latestMessage in Chat
        await Chat.findByIdAndUpdate(chatId, {
            latestMessage: newMessage._id,
        });

        // 5. Return full message data
        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage,
        });

    } catch (error) {
        console.error('Send Message Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.',
        });
    }
};

const allMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    res.status(400);
    throw new Error("chatId is required");
  }

  const messages = await Message.find({ chat: chatId })
    .populate("sender", "name profilePic email")
    .populate("chat")
    .sort({ createdAt: 1 });

  res.status(200).json(messages);
});

export { sendMessage , allMessages};

