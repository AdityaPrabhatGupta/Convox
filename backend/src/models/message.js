import { Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    // Who sent the message
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
    },

    // The Acutal message Text

    content: {
      type: String,
      required: [true, "Messsage content is required"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },

    // Which Chat this message belongs To

    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: [true, "Chat reference is required"],
    },

    //  For read receipts

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

const Message = model("Message", messageSchema);

export default Message;
