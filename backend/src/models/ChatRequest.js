// models/ChatRequest.js

import mongoose from "mongoose";

const chatRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true, // gives you createdAt + updatedAt automatically
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// 1. Speeds up "find all requests sent to this user" (inbox queries)
chatRequestSchema.index({ receiver: 1, status: 1 });

// 2. Speeds up "find all requests sent by this user" (outbox queries)
chatRequestSchema.index({ sender: 1, status: 1 });

// 3. THE MOST IMPORTANT INDEX
//    Enforces uniqueness at the DB level → prevents duplicate pending requests
//    Same sender → same receiver → only ONE pending request allowed
chatRequestSchema.index(
  { sender: 1, receiver: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    // ↑ Uniqueness only applies when status = "pending"
    // Once rejected/accepted, a new request CAN be sent later
  }
);

const ChatRequest = mongoose.model("ChatRequest", chatRequestSchema);

export default ChatRequest;