import { Schema, model } from "mongoose";

const chatSchema = new Schema(
  {
    // Array of users in this conversation

    users: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Latest message in this chat (for preview in chat list)

    latestMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // For group chats (future use)
    isGroupChat: {
      type: Boolean,
      default: false,
    },

    groupName: {
      type: String,
      trim: true,
      default: "",
    },

    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },

  { timestamps: true }, // adds createdAt and updatedAt automatically
);

const Chat = model("Chat", chatSchema);

export default Chat;
