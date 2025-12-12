/**
 * RefreshToken Model
 * 
 * Tracks refresh tokens in MongoDB for:
 * - Token rotation
 * - Token family tracking (detect reuse attacks)
 * - Token revocation
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tokenFamily: {
        type: String,
        required: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUsedAt: {
        type: Date,
        default: Date.now
    },
    isRevoked: {
        type: Boolean,
        default: false,
        index: true
    },
    revokedAt: {
        type: Date
    },
    revokedReason: {
        type: String,
        enum: ['logout', 'security', 'rotation', 'expired']
    },
    userAgent: {
        type: String
    },
    ipAddress: {
        type: String
    }
});

// TTL index - automatically delete expired tokens after 30 days
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Compound index for efficient queries
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ tokenFamily: 1, isRevoked: 1 });

/**
 * Hash token before storing
 * Never store plaintext tokens in database
 * 
 * @param {String} token - JWT refresh token
 * @returns {String} SHA256 hash of token
 */
refreshTokenSchema.statics.hashToken = function (token) {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Create and save refresh token record
 * 
 * @param {String} userId - User ID
 * @param {String} token - JWT refresh token
 * @param {String} tokenFamily - Token family ID
 * @param {Date} expiresAt - Expiration date
 * @param {Object} metadata - Additional metadata (userAgent, ipAddress)
 * @returns {Promise<RefreshToken>}
 */
refreshTokenSchema.statics.createToken = async function (userId, token, tokenFamily, expiresAt, metadata = {}) {
    const tokenHash = this.hashToken(token);

    return this.create({
        userId,
        tokenFamily,
        tokenHash,
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress
    });
};

/**
 * Verify refresh token exists and is valid
 * 
 * @param {String} token - JWT refresh token
 * @returns {Promise<RefreshToken|null>}
 */
refreshTokenSchema.statics.verifyToken = async function (token) {
    const tokenHash = this.hashToken(token);

    return this.findOne({
        tokenHash,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
    });
};

/**
 * Revoke refresh token
 * 
 * @param {String} token - JWT refresh token
 * @param {String} reason - Revocation reason
 * @returns {Promise<RefreshToken|null>}
 */
refreshTokenSchema.statics.revokeToken = async function (token, reason = 'logout') {
    const tokenHash = this.hashToken(token);

    return this.findOneAndUpdate(
        { tokenHash },
        {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: reason
        },
        { new: true }
    );
};

/**
 * Revoke all tokens in a family (security measure)
 * Used when token reuse is detected
 * 
 * @param {String} tokenFamily - Token family ID
 * @returns {Promise<Object>}
 */
refreshTokenSchema.statics.revokeFamily = async function (tokenFamily) {
    return this.updateMany(
        { tokenFamily, isRevoked: false },
        {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: 'security'
        }
    );
};

/**
 * Revoke all tokens for a user
 * Used on password change or account compromise
 * 
 * @param {String} userId - User ID
 * @returns {Promise<Object>}
 */
refreshTokenSchema.statics.revokeAllUserTokens = async function (userId) {
    return this.updateMany(
        { userId, isRevoked: false },
        {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: 'security'
        }
    );
};

/**
 * Clean up expired and revoked tokens
 * Called by cron job
 * 
 * @returns {Promise<Object>}
 */
refreshTokenSchema.statics.cleanup = async function () {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return this.deleteMany({
        $or: [
            { expiresAt: { $lt: new Date() } },
            { isRevoked: true, revokedAt: { $lt: thirtyDaysAgo } }
        ]
    });
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
