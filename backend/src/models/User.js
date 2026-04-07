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
            required: [true, 'Password is required.'],
            minlength: [8, 'Password must be at least 8 characters.'],
            select: false,
        },

        profilePic: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = model('User', userSchema);

export default User;