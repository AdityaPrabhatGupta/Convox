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
            required: function requiredContent() {
                const t = this.type || 'text';
                return t === 'text' && !this.isDeletedForEveryone;
            },
            trim: true,
            minlength: [0, 'Message cannot be empty.'],
            maxlength: [2000, 'Message cannot exceed 2000 characters.'],
            default: '',
        },

        // Which chat this message belongs to
        chat: {
            type: Schema.Types.ObjectId,
            ref: 'Chat',
            required: [true, 'Chat reference is required.'],
        },

        type: {
            type: String,
            enum: ['text', 'image', 'video', 'audio', 'file', 'call_log'],
            default: 'text',
        },

        // Metadata for call log system messages (type === 'call_log')
        callMeta: {
            callType: {
                type: String,
                enum: ['audio', 'video'],
                default: null,
            },
            outcome: {
                type: String,
                enum: ['ended', 'missed', 'declined'],
                default: null,
            },
            duration: {
                type: Number,
                default: 0,
            },
        },

        mediaUrl: {
            type: String,
            default: null,
        },

        fileName: {
            type: String,
            default: null,
        },

        fileSize: {
            type: Number,
            default: null,
        },

        mimeType: {
            type: String,
            default: null,
        },

        // For read receipts — use $addToSet when updating, never $push
        readBy: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],

        reactions: [
            {
                emoji: {
                    type: String,
                    required: true,
                    trim: true,
                },
                user: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
            },
        ],

        deletedFor: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],

        isDeletedForEveryone: {
            type: Boolean,
            default: false,
        },

        editedAt: {
            type: Date,
            default: null,
        },

        pinnedAt: {
            type: Date,
            default: null,
        },

        replyTo: {
            type: Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },

        forwardedFrom: {
            messageId: {
                type: Schema.Types.ObjectId,
                ref: 'Message',
                default: null,
            },
            senderName: {
                type: String,
                default: '',
            },
        },

        isSystem: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);

// Covers Message.find({ chat: chatId }).sort({ createdAt: 1 }) in one index
messageSchema.index({ chat: 1, createdAt: 1 });

// Covers lookups by sender (deletion, audit, analytics)
messageSchema.index({ sender: 1 });

// Supports timeline filtering and cursor-based pagination
messageSchema.index({ createdAt: -1 });

messageSchema.pre('validate', function normalizeMessageShape() {
    const t = this.type || 'text';
    if (t === 'text' && !this.isDeletedForEveryone) {
        if (!this.content?.trim()) {
            this.invalidate('content', 'Message content is required.');
        }
    } else {
        this.content = this.content || '';
    }
});

const Message = model('Message', messageSchema);

export default Message;
