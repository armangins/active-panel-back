/**
 * TokenBlacklist Model
 * 
 * Stores blacklisted JWT tokens to prevent their use before expiration
 * Used for:
 * - Immediate logout (invalidate access token)
 * - Security incidents (revoke compromised tokens)
 * - Token rotation (invalidate old tokens)
 */

const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
    jti: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    tokenType: {
        type: String,
        enum: ['access', 'refresh'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    blacklistedAt: {
        type: Date,
        default: Date.now
    },
    reason: {
        type: String,
        enum: ['logout', 'security', 'rotation', 'manual'],
        required: true
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        notes: String
    }
});

// TTL index - automatically delete expired blacklist entries
// Tokens are deleted 1 day after expiration
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

/**
 * Add token to blacklist
 * 
 * @param {String} jti - JWT ID from token
 * @param {String} userId - User ID
 * @param {String} tokenType - 'access' or 'refresh'
 * @param {Date} expiresAt - Token expiration date
 * @param {String} reason - Blacklist reason
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<TokenBlacklist>}
 */
tokenBlacklistSchema.statics.addToken = async function (jti, userId, tokenType, expiresAt, reason, metadata = {}) {
    return this.create({
        jti,
        userId,
        tokenType,
        expiresAt,
        reason,
        metadata
    });
};

/**
 * Check if token is blacklisted
 * 
 * @param {String} jti - JWT ID from token
 * @returns {Promise<Boolean>}
 */
tokenBlacklistSchema.statics.isBlacklisted = async function (jti) {
    const entry = await this.findOne({
        jti,
        expiresAt: { $gt: new Date() }
    });

    return !!entry;
};

/**
 * Blacklist all tokens for a user
 * Used on password change or account compromise
 * 
 * @param {String} userId - User ID
 * @param {String} reason - Blacklist reason
 * @returns {Promise<Number>} Number of tokens blacklisted
 */
tokenBlacklistSchema.statics.blacklistUserTokens = async function (userId, reason = 'security') {
    // This would require decoding all active tokens, which is not practical
    // Instead, we rely on revoking refresh tokens and letting access tokens expire naturally
    // For immediate revocation, we'd need to track all issued access tokens (not recommended)

    // For now, this is a placeholder that could be implemented with a token tracking system
    console.warn('blacklistUserTokens: Access tokens will expire naturally. Refresh tokens should be revoked separately.');
    return 0;
};

/**
 * Clean up expired blacklist entries
 * Called by cron job (though TTL index handles this automatically)
 * 
 * @returns {Promise<Object>}
 */
tokenBlacklistSchema.statics.cleanup = async function () {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
};

/**
 * Get blacklist statistics
 * For monitoring and debugging
 * 
 * @returns {Promise<Object>}
 */
tokenBlacklistSchema.statics.getStats = async function () {
    const total = await this.countDocuments();
    const active = await this.countDocuments({ expiresAt: { $gt: new Date() } });
    const expired = total - active;

    const byReason = await this.aggregate([
        { $match: { expiresAt: { $gt: new Date() } } },
        { $group: { _id: '$reason', count: { $sum: 1 } } }
    ]);

    return {
        total,
        active,
        expired,
        byReason: byReason.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {})
    };
};

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

module.exports = TokenBlacklist;
