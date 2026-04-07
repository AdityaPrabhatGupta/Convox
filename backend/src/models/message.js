import { Schema, model } from 'mongoose';

const messageSchema = new Schema(
    {
        // Who sent the message
        sender: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Sender is required.'],
        },

        // The actual message text
        content: {
            type: String,
            required: [true, 'Message content is required.'],
            trim: true,
            minlength: [1, 'Message cannot be empty.'],
            maxlength: [2000, 'Message cannot exceed 2000 characters.'],
        },

        // Which chat this message belongs to
        chat: {
            type: Schema.Types.ObjectId,
            ref: 'Chat',
            required: [true, 'Chat reference is required.'],
        },

        // For read receipts — use $addToSet when updating, never $push
        readBy: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
    },
    { timestamps: true },
);

// Covers Message.find({ chat: chatId }).sort({ createdAt: 1 }) in one index
messageSchema.index({ chat: 1, createdAt: 1 });

// Covers lookups by sender (deletion, audit, analytics)
messageSchema.index({ sender: 1 });

const Message = model('Message', messageSchema);

export default Message;