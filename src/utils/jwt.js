

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load RSA keys from environment variables (production) or files (development)
let PRIVATE_KEY, PUBLIC_KEY;

if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    // Production: Load from environment variables
    try {
        // Try to detect if keys are base64 encoded or plain text
        let privateKey = process.env.JWT_PRIVATE_KEY;
        let publicKey = process.env.JWT_PUBLIC_KEY;

        // If keys don't start with -----BEGIN, they're probably base64 encoded
        if (!privateKey.includes('-----BEGIN')) {
            console.log('Decoding JWT keys from base64...');
            privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
            publicKey = Buffer.from(publicKey, 'base64').toString('utf8');
        }

        // Verify keys are properly formatted
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            throw new Error('Private key is not properly formatted (missing -----BEGIN PRIVATE KEY-----)');
        }
        if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
            throw new Error('Public key is not properly formatted (missing -----BEGIN PUBLIC KEY-----)');
        }

        PRIVATE_KEY = privateKey;
        PUBLIC_KEY = publicKey;

        console.log('✅ JWT keys loaded from environment variables');
        console.log('Private key length:', PRIVATE_KEY.length);
        console.log('Public key length:', PUBLIC_KEY.length);
    } catch (error) {
        console.error('❌ Failed to load JWT keys from environment variables:', error.message);
        console.error('Please ensure JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are set correctly');
        process.exit(1);
    }
} else {
    // Development: Load from files
    try {
        PRIVATE_KEY = fs.readFileSync(
            path.join(__dirname, '../../keys/private.pem'),
            'utf8'
        );
        PUBLIC_KEY = fs.readFileSync(
            path.join(__dirname, '../../keys/public.pem'),
            'utf8'
        );
        console.log('✅ JWT keys loaded from files');
    } catch (error) {
        console.error('❌ Failed to load JWT keys:', error.message);
        console.error('Please set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables or ensure keys exist in keys/ directory');
        process.exit(1);
    }
}

// Token configuration
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';
const ISSUER = process.env.JWT_ISSUER || 'active-panel-api';
const AUDIENCE = process.env.JWT_AUDIENCE || 'active-panel-frontend';

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

    // Pass key as object for RS256
    return jwt.sign(payload, { key: PRIVATE_KEY, passphrase: '' }, options);
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

    // Pass key as object for RS256
    return jwt.sign(payload, { key: PRIVATE_KEY, passphrase: '' }, options);
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
