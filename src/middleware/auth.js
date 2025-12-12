/**
 * JWT Authentication Middleware
 * 
 * Verifies JWT access tokens and checks blacklist
 */

const jwt = require('../utils/jwt');
const TokenBlacklist = require('../models/TokenBlacklist');
const User = require('../models/User');

module.exports = {
    /**
     * Ensure user is authenticated with valid JWT
     */
    ensureAuth: async function (req, res, next) {
        try {
            // Extract token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    error: 'No token provided',
                    code: 'NO_TOKEN'
                });
            }

            const token = authHeader.split(' ')[1];

            // Verify token signature and expiration
            const decoded = jwt.verifyAccessToken(token);

            // Check if token is blacklisted
            const isBlacklisted = await TokenBlacklist.isBlacklisted(decoded.jti);

            if (isBlacklisted) {
                return res.status(401).json({
                    error: 'Token has been revoked',
                    code: 'TOKEN_REVOKED'
                });
            }

            // Get user from database (optional - for fresh user data)
            // Comment out if you want to rely solely on token payload
            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Attach user data to request
            req.user = user;
            req.userId = decoded.userId;
            req.tokenPayload = decoded;

            next();
        } catch (error) {
            // Handle specific JWT errors
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                });
            }

            // Generic error
            console.error('[Auth Middleware] Error:', error.message);
            return res.status(401).json({
                error: 'Authentication failed',
                code: 'AUTH_FAILED'
            });
        }
    },

    /**
     * Ensure user is NOT authenticated (guest only)
     */
    ensureGuest: function (req, res, next) {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            return res.status(403).json({
                error: 'Already authenticated',
                code: 'ALREADY_AUTHENTICATED'
            });
        }

        return next();
    }
};
