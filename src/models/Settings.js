const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    storeUrl: {
        type: String,
        required: true
    },
    consumerKey: {
        type: String, // Stores iv:encryptedData
        required: true
    },
    consumerSecret: {
        type: String, // Stores iv:encryptedData
        required: true
    },
    wordpressUsername: {
        type: String,
        required: false
    },
    wordpressAppPassword: {
        type: String, // Stores iv:encryptedData
        required: false
    }
}, {
    timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema, 'user_set');

module.exports = Settings;
