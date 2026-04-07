import { Schema, model } from 'mongoose';

const chatSchema = new Schema(
    {
        users: {
            type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
            validate: {
                validator: (arr) => arr.length >= 2 && arr.length <= 50,
                message: 'A chat must have between 2 and 50 users.',
            },
        },

        latestMessage: {
            type: Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },

        isGroupChat: {
            type: Boolean,
            default: false,
        },

        groupName: {
            type: String,
            trim: true,
            default: '',
            validate: {
                validator: function (val) {
                    return !this.isGroupChat || (val && val.trim().length > 0);
                },
                message: 'Group name is required for group chats.',
            },
        },

        groupAdmin: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            validate: {
                validator: function (val) {
                    return !this.isGroupChat || val != null;
                },
                message: 'Group admin is required for group chats.',
            },
        },
    },
    { timestamps: true },
);

chatSchema.index({ users: 1 });
chatSchema.index({ latestMessage: 1 });

const Chat = model('Chat', chatSchema);

export default Chat;