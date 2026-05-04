import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required.'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters.'],
            maxlength: [50, 'Name cannot exceed 50 characters.'],
        },

        email: {
            type: String,
            required: [true, 'Email is required.'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                'Please provide a valid email.',
            ],
        },

        password: {
            type: String,
            required: false,    // null for Google-only accounts
            minlength: [8, 'Password must be at least 8 characters.'],
            select: false,
        },

        googleId: {
            type: String,
            default: null,
            unique: true,
            sparse: true,       // allows multiple nulls while enforcing uniqueness on real IDs
        },

        profilePic: {
            type: String,
            default: null,
        },

        bio: {
            type: String,
            trim: true,
            maxlength: [30, 'Bio cannot exceed 30 characters.'],
            default: '',
        },

        lastSeen: {
            type: Date,
            default: null,
        },

        blockedUsers: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],

        removedUsers: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],

        isBot: {
            type: Boolean,
            default: false,
        },

        refreshTokenHash: {
            type: String,
            default: null,
            select: false,
        },

        refreshTokenExpiresAt: {
            type: Date,
            default: null,
            select: false,
        },
    },
    { timestamps: true }
);

// Only hash password when it is present and modified
userSchema.pre('save', async function () {
    if (!this.password || !this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidatePassword) {
    if (!this.password) return Promise.resolve(false);
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ name: 'text', email: 'text' });

const User = model('User', userSchema);

export default User;
