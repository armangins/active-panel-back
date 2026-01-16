/**
 * JWT Auth Routes - New Implementation
 * 
 * JWT-based authentication endpoints
 * This file contains the new JWT implementation
 */

const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const TokenBlacklist = require('../models/TokenBlacklist');
const jwt = require('../utils/jwt');
const validate = require('../middleware/validate');
const { loginSchema, registerSchema } = require('../schemas/auth');
const { ensureAuth } = require('../middleware/auth');
const { admin } = require('../config/firebase');

const router = express.Router();

// Rate limiters
const authCheckLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 login attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many login attempts, please try again later.'
    }
});

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 refresh attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many refresh attempts, please try again later.'
    }
});

/**
 * Helper: Set refresh token cookie
 */
const setRefreshTokenCookie = (res, refreshToken) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        // Secure is REQUIRED for SameSite=None
        secure: isProduction,
        // SameSite=None is REQUIRED for cross-site cookies (different domains)
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh' // Only send to refresh endpoint
    });
};

/**
 * Helper: Clear refresh token cookie
 */
const clearRefreshTokenCookie = (res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/api/auth/refresh'
    });
};

// @desc    Login with email/password
// @route   POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user has password (not Google-only account)
        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: 'Please login with Google'
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token family
        const tokenFamily = jwt.generateTokenFamily();

        // Generate tokens
        const accessToken = jwt.generateAccessToken(user);
        const refreshToken = jwt.generateRefreshToken(user, tokenFamily);

        // Store refresh token in database
        const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await RefreshToken.createToken(
            user._id,
            refreshToken,
            tokenFamily,
            refreshTokenExpiry,
            {
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip
            }
        );

        // Set refresh token cookie
        setRefreshTokenCookie(res, refreshToken);

        // Return access token
        res.json({
            success: true,
            accessToken,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                role: user.role || 'user',
                picture: user.image,
                onboardingCompleted: user.onboardingCompleted || false
            }
        });
    } catch (error) {
        console.error('[Login] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
router.post('/refresh', refreshLimiter, async (req, res) => {
    try {
        // Get refresh token from cookie
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'No refresh token provided',
                code: 'NO_REFRESH_TOKEN'
            });
        }

        // Verify refresh token JWT
        let decoded;
        try {
            decoded = jwt.verifyRefreshToken(refreshToken);
        } catch (error) {
            clearRefreshTokenCookie(res);
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }

        // Check if refresh token exists in database and is valid
        const storedToken = await RefreshToken.verifyToken(refreshToken);

        if (!storedToken) {
            // Token not found or revoked - possible token reuse attack
            // Revoke entire token family
            await RefreshToken.revokeFamily(decoded.tokenFamily);
            clearRefreshTokenCookie(res);

            console.warn('[Refresh] Token reuse detected! Family revoked:', decoded.tokenFamily);

            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token',
                code: 'TOKEN_REUSE_DETECTED'
            });
        }

        // Get user
        const user = await User.findById(decoded.userId);
        if (!user) {
            await RefreshToken.revokeToken(refreshToken, 'security');
            clearRefreshTokenCookie(res);
            return res.status(401).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Generate new tokens (token rotation)
        const newAccessToken = jwt.generateAccessToken(user);
        const newRefreshToken = jwt.generateRefreshToken(user, decoded.tokenFamily);

        // Revoke old refresh token
        await RefreshToken.revokeToken(refreshToken, 'rotation');

        // Store new refresh token
        const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await RefreshToken.createToken(
            user._id,
            newRefreshToken,
            decoded.tokenFamily,
            refreshTokenExpiry,
            {
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip
            }
        );

        // Set new refresh token cookie
        setRefreshTokenCookie(res, newRefreshToken);

        // Return new access token
        res.json({
            success: true,
            accessToken: newAccessToken
        });
    } catch (error) {
        console.error('[Refresh] Error:', error.message);
        clearRefreshTokenCookie(res);
        res.status(500).json({
            success: false,
            message: 'Token refresh failed',
            code: 'REFRESH_FAILED'
        });
    }
});

// @desc    Logout user
// @route   POST /api/auth/logout
router.post('/logout', ensureAuth, async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        // Blacklist access token
        const accessTokenPayload = req.tokenPayload;
        if (accessTokenPayload && accessTokenPayload.jti) {
            await TokenBlacklist.addToken(
                accessTokenPayload.jti,
                req.userId,
                'access',
                new Date(accessTokenPayload.exp * 1000),
                'logout'
            );
        }

        // Revoke refresh token
        if (refreshToken) {
            await RefreshToken.revokeToken(refreshToken, 'logout');
        }

        // Clear refresh token cookie
        clearRefreshTokenCookie(res);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('[Logout] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

// @desc    Get current user
// @route   GET /api/auth/me
router.get('/me', authCheckLimiter, ensureAuth, (req, res) => {
    res.json({
        isAuthenticated: true,
        user: {
            id: req.user._id,
            email: req.user.email,
            displayName: req.user.displayName,
            role: req.user.role || 'user',
            picture: req.user.image,
            onboardingCompleted: req.user.onboardingCompleted || false,
            onboardingCompletedAt: req.user.onboardingCompletedAt || null
        }
    });
});

// @desc    Register new user
// @route   POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        user = await User.create({
            email,
            password: hashedPassword,
            displayName: name
        });

        // Generate token family
        const tokenFamily = jwt.generateTokenFamily();

        // Generate tokens
        const accessToken = jwt.generateAccessToken(user);
        const refreshToken = jwt.generateRefreshToken(user, tokenFamily);

        // Store refresh token
        const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await RefreshToken.createToken(
            user._id,
            refreshToken,
            tokenFamily,
            refreshTokenExpiry,
            {
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip
            }
        );

        // Set refresh token cookie
        setRefreshTokenCookie(res, refreshToken);

        // Return access token
        res.status(201).json({
            success: true,
            accessToken,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                role: user.role || 'user'
            }
        });
    } catch (error) {
        console.error('[Register] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
});

// @desc    Mark onboarding as completed
// @route   POST /api/auth/onboarding/complete
router.post('/onboarding/complete', ensureAuth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.onboardingCompleted = true;
        user.onboardingCompletedAt = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'Onboarding marked as completed',
            onboardingCompleted: true,
            onboardingCompletedAt: user.onboardingCompletedAt
        });
    } catch (error) {
        console.error('[Onboarding] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to mark onboarding as complete'
        });
    }
});

// ==========================================
// Google OAuth with JWT
// ==========================================

// @desc    Auth with Google (Login)
// @route   GET /api/auth/google
router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Google Auth Credentials missing in server configuration.' });
    }
    
    // Encode the origin in the state parameter if provided
    const origin = req.query.origin;
    const state = origin ? Buffer.from(origin).toString('base64') : undefined;

    // Use google-login strategy
    passport.authenticate('google-login', {
        scope: ['profile', 'email'],
        prompt: 'select_account',
        state: state
    })(req, res, next);
});

// @desc    Google auth callback - JWT version
// @route   GET /api/auth/google/callback
router.get('/google/callback', (req, res, next) => {
    // Helper to determine the correct frontend URL
    const getValidFrontendUrl = (state) => {
        const defaultUrl = process.env.FRONTEND_URL || 'https://activepanel.co.il';
        if (!state) return defaultUrl;
        
        try {
            const origin = Buffer.from(state, 'base64').toString('ascii');
            // Allow localhost and production domains
            const allowedOrigins = [
                'http://localhost:5173',
                'http://localhost:3000',
                'https://active-panel.web.app',
                'https://activepanel.co.il',
                'https://www.activepanel.co.il'
            ];
            
            if (allowedOrigins.includes(origin)) {
                return origin;
            }
        } catch (e) {
            console.error('Invalid state param in OAuth callback', e);
        }
        return defaultUrl;
    };

    const frontendUrl = getValidFrontendUrl(req.query.state);

    // Check for OAuth errors in query params
    if (req.query.error) {
        const oauthError = req.query.error;
        const oauthErrorDescription = req.query.error_description || 'OAuth authentication failed';

        console.error('Google OAuth Error in callback:', oauthError, oauthErrorDescription);

        let errorMessage = 'Authentication failed: Authentication error';
        if (oauthError === 'access_denied') {
            errorMessage = 'Authentication cancelled. Please try again.';
        } else if (oauthError === 'redirect_uri_mismatch') {
            errorMessage = 'Authentication failed: Callback URL mismatch. Please contact support.';
        } else {
            errorMessage = `Authentication failed: ${oauthErrorDescription}`;
        }

        return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent(errorMessage)}`);
    }

    passport.authenticate('google-login', async (err, user, info) => {
        if (err) {
            console.error('Google Login OAuth Error:', err.message);
            let errorMessage = 'An error occurred during authentication. Please try again.';
            if (err.message) {
                errorMessage = `Authentication failed: ${err.message}`;
            }
            return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent(errorMessage)}`);
        }

        if (!user) {
            const errorMessage = info?.message || 'Authentication failed. Please use email/password login.';
            return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent(errorMessage)}`);
        }

        try {
            // Generate token family
            const tokenFamily = jwt.generateTokenFamily();

            // Generate JWT tokens
            const accessToken = jwt.generateAccessToken(user);
            const refreshToken = jwt.generateRefreshToken(user, tokenFamily);

            // Store refresh token in database
            const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            await RefreshToken.createToken(
                user._id,
                refreshToken,
                tokenFamily,
                refreshTokenExpiry,
                {
                    userAgent: req.headers['user-agent'],
                    ipAddress: req.ip
                }
            );

            // Set refresh token cookie
            setRefreshTokenCookie(res, refreshToken);

            // Redirect to frontend with access token
            res.redirect(`${frontendUrl}/auth/callback?access_token=${accessToken}`);
        } catch (error) {
            console.error('[OAuth JWT] Error generating tokens:', error.message);
            return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent('Failed to generate authentication tokens. Please try again.')}`);
        }
    })(req, res, next);
});

// @desc    Get Firebase Custom Token
// @route   GET /api/auth/firebase-token
router.get('/firebase-token', ensureAuth, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        // Create custom token
        const firebaseToken = await admin.auth().createCustomToken(userId, {
            role: req.user.role // Optional claims
        });

        res.json({
            success: true,
            firebaseToken
        });
    } catch (error) {
        console.error('Error creating Firebase custom token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create Firebase token'
        });
    }
});

module.exports = router;
