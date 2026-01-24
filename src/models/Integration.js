const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    provider: {
        type: String,
        required: true,
        enum: ['woocommerce', 'google_drive'],
        trim: true
    },
    name: {
        type: String,
        trim: true,
        default: 'My Integration'
    },
    credentials: {
        type: Map,
        of: String,
        select: false // SECURITY: Do not return secrets by default
    },
    settings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { 
        transform: function(doc, ret) {
            delete ret.credentials; // SECURITY: Double check to strip secrets
            return ret;
        }
    }
});

// Enforce one provider type per user (for now)
integrationSchema.index({ user: 1, provider: 1 }, { unique: true });

const Integration = mongoose.model('Integration', integrationSchema);

module.exports = Integration;
