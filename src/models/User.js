const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allow unique index to ignore nulls
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        select: false // Do not return password by default
    },
    displayName: {
        type: String,
        required: true
    },
    firstName: String,
    lastName: String,
    image: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    onboardingCompleted: {
        type: Boolean,
        default: false
    },
    onboardingCompletedAt: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('User', userSchema);
