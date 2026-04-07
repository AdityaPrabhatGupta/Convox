import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';

// POST /api/messages
const sendMessage = asyncHandler(async (req, res) => {
    const { content, chatId } = req.body;

    // 1. Validate input
    if (!content || !chatId) {
        res.status(400);
        throw new Error('Content and chatId are required');
    }

    // 2. Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        res.status(400);
        throw new Error('Invalid chatId');
    }

    // 3. Verify chat exists and sender is a member
    const chat = await Chat.findOne({ _id: chatId, users: req.user._id });
    if (!chat) {
        res.status(403);
        throw new Error('Chat not found or access denied');
    }

    // 4. Create new message
    const created = await Message.create({
        sender: req.user._id,
        content: content.trim(),
        chat: chatId,
    });

    // 5. Populate in a single query (avoids double DB round-trip)
    const newMessage = await Message.findById(created._id)
        .populate('sender', 'name email profilePic')
        .populate({
            path: 'chat',
            populate: {
                path: 'users',
                select: 'name email profilePic',
            },
        });

    // 6. Update latestMessage in Chat
    await Chat.findByIdAndUpdate(chatId, { latestMessage: newMessage._id });

    res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: newMessage,
    });
});

// GET /api/messages/:chatId
const allMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    // 1. Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        res.status(400);
        throw new Error('Invalid chatId');
    }

    // 2. Verify chat exists and requester is a member
    const chat = await Chat.findOne({ _id: chatId, users: req.user._id });
    if (!chat) {
        res.status(403);
        throw new Error('Chat not found or access denied');
    }

    // 3. Fetch messages
    const messages = await Message.find({ chat: chatId })
        .populate('sender', 'name profilePic email')
        .populate('chat')
        .sort({ createdAt: 1 });

    res.status(200).json({
        success: true,
        data: messages,
    });
});

export { sendMessage, allMessages };