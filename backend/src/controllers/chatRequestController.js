import ChatRequest from "../models/ChatRequest.js";
import Chat from "../models/Chat.js";
import { getReceiverSocketId, io } from "../socket/socket.js";

export const sendChatRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (senderId.toString() === receiverId) {
      return res
        .status(400)
        .json({ message: "You cannot send a request to yourself." });
    }

    const existingChat = await Chat.findOne({
      members: { $all: [senderId, receiverId] },
    });

    if (existingChat) {
      return res
        .status(400)
        .json({ message: "You are already in a chat with this user." });
    }

    const request = await ChatRequest.create({
      sender: senderId,
      receiver: receiverId,
    });

    const populatedRequest = await request.populate(
      "sender",
      "name email profilePic",
    );

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newChatRequest", populatedRequest);
    }

    res.status(201).json({
      message: "Chat request sent.",
      request: populatedRequest,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Chat request already pending." });
    }

    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getIncomingRequests = async (req, res) => {
  try {
    const requests = await ChatRequest.find({
      receiver: req.user._id,
      status: "pending",
    }).populate("sender", "name email profilePic");

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getOutgoingRequests = async (req, res) => {
  try {
    const requests = await ChatRequest.find({
      sender: req.user._id,
      status: "pending",
    }).populate("receiver", "name email profilePic");

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const acceptChatRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await ChatRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Request already ${request.status}.` });
    }

    request.status = "accepted";
    await request.save();

    const newChat = await Chat.create({
      members: [request.sender, request.receiver],
    });

    const senderSocketId = getReceiverSocketId(request.sender.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("chatRequestAccepted", { chat: newChat });
    }

    res.status(200).json({
      message: "Chat request accepted.",
      chat: newChat,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const rejectChatRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await ChatRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Request already ${request.status}.` });
    }

    request.status = "rejected";
    await request.save();

    res.status(200).json({ message: "Chat request rejected." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const cancelChatRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await ChatRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (request.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending requests can be cancelled." });
    }

    await request.deleteOne();

    res.status(200).json({ message: "Chat request cancelled." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
