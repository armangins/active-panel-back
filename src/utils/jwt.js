/**
 * JWT Utility Functions
 * 
 * Secure JWT token generation and verification using RSA asymmetric encryption
 * - Access tokens: Short-lived (15 min), stored in memory
 * - Refresh tokens: Long-lived (7 days), stored in httpOnly cookies
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load RSA keys
const PRIVATE_KEY = fs.readFileSync(
    path.join(__dirname, '../../keys/private.pem'),
    'utf8'
);
const PUBLIC_KEY = fs.readFileSync(
    path.join(__dirname, '../../keys/public.pem'),
    'utf8'
);

// Token configuration
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';
const ISSUER = process.env.JWT_ISSUER || 'active-panel-api';
const AUDIENCE = process.env.JWT_AUDIENCE || 'active-panel-frontend';

/**
 * Generate unique token family ID
 * Used to track refresh token families and detect token reuse
 */
const generateTokenFamily = () => {
    return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate unique JWT ID (jti)
 * Used for token blacklisting
 */
const generateJti = () => {
    return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate access token
 * Short-lived token for API authentication
 * 
 * @param {Object} user - User object from database
 * @returns {String} JWT access token
 */
const generateAccessToken = (user) => {
    const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'user',
        type: 'access'
    };

    const options = {
        algorithm: 'RS256',
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: ISSUER,
        audience: AUDIENCE,
        jwtid: generateJti() // For blacklisting
    };

    return jwt.sign(payload, PRIVATE_KEY, options);
};

/**
 * Generate refresh token
 * Long-lived token for getting new access tokens
 * 
 * @param {Object} user - User object from database
 * @param {String} tokenFamily - Token family ID
 * @returns {String} JWT refresh token
 */
const generateRefreshToken = (user, tokenFamily) => {
    const payload = {
        userId: user._id.toString(),
        tokenFamily: tokenFamily,
        type: 'refresh'
    };

    const options = {
        algorithm: 'RS256',
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: ISSUER,
        audience: AUDIENCE,
        jwtid: generateJti()
    };

    return jwt.sign(payload, PRIVATE_KEY, options);
};

/**
 * Verify access token
 * 
 * @param {String} token - JWT access token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyAccessToken = (token) => {
    const options = {
        algorithms: ['RS256'],
        issuer: ISSUER,
        audience: AUDIENCE
    };

    const decoded = jwt.verify(token, PUBLIC_KEY, options);

    // Verify token type
    if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
    }

    return decoded;
};

/**
 * Verify refresh token
 * 
 * @param {String} token - JWT refresh token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyRefreshToken = (token) => {
    const options = {
        algorithms: ['RS256'],
        issuer: ISSUER,
        audience: AUDIENCE
    };

    const decoded = jwt.verify(token, PUBLIC_KEY, options);

    // Verify token type
    if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
    }

    return decoded;
};

/**
 * Decode token without verification (for debugging)
 * WARNING: Do not use for authentication
 * 
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
const decodeToken = (token) => {
    return jwt.decode(token);
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateTokenFamily,
    generateJti,
    decodeToken
};
