/**
 * Token Cleanup Job
 * 
 * Cron job to clean up expired tokens from database
 * Runs every hour to keep database clean
 */

const RefreshToken = require('../models/RefreshToken');
const TokenBlacklist = require('../models/TokenBlacklist');

/**
 * Clean up expired and revoked tokens
 */
const cleanupTokens = async () => {
    try {
        console.log('[Token Cleanup] Starting cleanup job...');

        // Clean up refresh tokens
        const refreshResult = await RefreshToken.cleanup();
        console.log(`[Token Cleanup] Deleted ${refreshResult.deletedCount} expired/revoked refresh tokens`);

        // Clean up blacklist (though TTL index handles this)
        const blacklistResult = await TokenBlacklist.cleanup();
        console.log(`[Token Cleanup] Deleted ${blacklistResult.deletedCount} expired blacklist entries`);

        // Log statistics
        const refreshCount = await RefreshToken.countDocuments({ isRevoked: false });
        const blacklistStats = await TokenBlacklist.getStats();

        console.log('[Token Cleanup] Current state:', {
            activeRefreshTokens: refreshCount,
            blacklistStats
        });

        console.log('[Token Cleanup] Cleanup completed successfully');
    } catch (error) {
        console.error('[Token Cleanup] Error during cleanup:', error.message);
    }
};

/**
 * Start cleanup job
 * Runs every hour
 */
const startCleanupJob = () => {
    // Run immediately on startup
    cleanupTokens();

    // Then run every hour
    const HOUR_IN_MS = 60 * 60 * 1000;
    setInterval(cleanupTokens, HOUR_IN_MS);

    console.log('[Token Cleanup] Cleanup job started (runs every hour)');
};

module.exports = {
    cleanupTokens,
    startCleanupJob
};
