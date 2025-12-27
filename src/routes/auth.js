const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { loginSchema, registerSchema } = require('../schemas/auth');
const router = express.Router();

const authCheckLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});


router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Google Auth Credentials missing in server configuration.' });
    }
    // Use google-login strategy
    passport.authenticate('google-login', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res, next);
});


router.get('/google/signup', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Google Auth Credentials missing in server configuration.' });
    }
    // Use google-signup strategy
    passport.authenticate('google-signup', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res, next);
});


router.get('/google/callback',
    (req, res, next) => {
        if (req.query.error) {
            let frontendUrl = process.env.FRONTEND_URL;
            if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
                frontendUrl = frontendUrl.replace('http://', 'https://');
            }

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

        passport.authenticate('google-login', (err, user, info) => {
            let frontendUrl = process.env.FRONTEND_URL;
            // Enforce HTTPS in production
            if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
                frontendUrl = frontendUrl.replace('http://', 'https://');
            }

            if (err) {
                // Server error
                console.error('Google Login OAuth Error:', err.message);
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error details:', {
                        message: err.message,
                        stack: err.stack,
                        name: err.name
                    });
                }

                let errorMessage = 'An error occurred during authentication. Please try again.';
                if (err.message) {
                    errorMessage = `Authentication failed: ${err.message}`;
                    if (err.message.includes('Unauthorized')) {
                        errorMessage = 'Authentication failed: Invalid Google OAuth credentials or callback URL mismatch. Please check your Google Cloud Console settings.';
                    }
                }

                return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent(errorMessage)}`);
            }

            if (!user) {
                // Authentication failed - user exists but not with Google
                const errorMessage = info?.message || 'Authentication failed. Please use email/password login.';
                const errorCode = info?.code || 'AUTH_FAILED';
                return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent(errorMessage)}&code=${encodeURIComponent(errorCode)}`);
            }


            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error('Login Error:', loginErr);
                    return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent('Failed to create session. Please try again.')}`);
                }

                req.session.touch();

                // Log session state before save (production only)
                if (process.env.NODE_ENV === 'production') {
                    console.log('[OAuth Login] Before session save:', {
                        sessionID: req.sessionID,
                        userID: user._id,
                        isAuthenticated: req.isAuthenticated()
                    });
                }

                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('[OAuth Login] Session save error:', saveErr);
                        return res.redirect(`${frontendUrl}/login?error=google_auth_failed&message=${encodeURIComponent('Failed to save session. Please try again.')}`);
                    }

                    if (process.env.NODE_ENV === 'production') {
                        console.log('[OAuth Login] Session saved successfully:', {
                            sessionID: req.sessionID,
                            redirectTo: `${frontendUrl}/dashboard`,
                            isAuthenticated: req.isAuthenticated(),
                            cookieConfig: {
                                secure: true,
                                sameSite: 'none',
                                httpOnly: true
                            }
                        });
                    }

                    res.redirect(`${frontendUrl}/dashboard`);
                });
            });
        })(req, res, next);
    }
);

// @desc    Google signup callback - identical to login (auto-creates users and logs them in)
// @route   GET /api/auth/google/signup/callback
router.get('/google/signup/callback',
    (req, res, next) => {
        // Check for OAuth errors in query params (Google sends errors here)
        if (req.query.error) {
            let frontendUrl = process.env.FRONTEND_URL;
            if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
                frontendUrl = frontendUrl.replace('http://', 'https://');
            }

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

            return res.redirect(`${frontendUrl}/login?error=google_signup_failed&message=${encodeURIComponent(errorMessage)}`);
        }

        passport.authenticate('google-signup', (err, user, info) => {
            let frontendUrl = process.env.FRONTEND_URL;
            // Enforce HTTPS in production
            if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
                frontendUrl = frontendUrl.replace('http://', 'https://');
            }

            if (err) {
                // Server error
                console.error('Google Signup OAuth Error:', err.message);
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error details:', {
                        message: err.message,
                        stack: err.stack,
                        name: err.name
                    });
                }

                let errorMessage = 'An error occurred during authentication. Please try again.';
                if (err.message) {
                    errorMessage = `Authentication failed: ${err.message}`;
                    if (err.message.includes('Unauthorized')) {
                        errorMessage = 'Authentication failed: Invalid Google OAuth credentials or callback URL mismatch. Please check your Google Cloud Console settings.';
                    }
                }

                return res.redirect(`${frontendUrl}/login?error=google_signup_failed&message=${encodeURIComponent(errorMessage)}`);
            }

            if (!user) {
                // Authentication failed - user exists but not with Google
                const errorMessage = info?.message || 'Authentication failed. Please use email/password login.';
                const errorCode = info?.code || 'AUTH_FAILED';
                return res.redirect(`${frontendUrl}/login?error=google_signup_failed&message=${encodeURIComponent(errorMessage)}&code=${encodeURIComponent(errorCode)}`);
            }

            // Successful authentication - log user in
            // User could be existing user or newly created user
            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error('Login Error:', loginErr);
                    return res.redirect(`${frontendUrl}/login?error=google_signup_failed&message=${encodeURIComponent('Failed to create session. Please try again.')}`);
                }

                // Ensure session is marked as modified so cookie is set
                req.session.touch();

                // Log session state before save (production only)
                if (process.env.NODE_ENV === 'production') {
                    console.log('[OAuth Signup] Before session save:', {
                        sessionID: req.sessionID,
                        userID: user._id,
                        isAuthenticated: req.isAuthenticated()
                    });
                }

                // Explicitly save session to MongoDB before redirect
                // This ensures the session cookie is set in the response
                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('[OAuth Signup] Session save error:', saveErr);
                        return res.redirect(`${frontendUrl}/login?error=google_signup_failed&message=${encodeURIComponent('Failed to save session. Please try again.')}`);
                    }

                    // Log successful login for debugging
                    if (process.env.NODE_ENV === 'production') {
                        console.log('[OAuth Signup] Session saved successfully:', {
                            sessionID: req.sessionID,
                            redirectTo: `${frontendUrl}/dashboard`,
                            isAuthenticated: req.isAuthenticated(),
                            cookieConfig: {
                                secure: true,
                                sameSite: 'none',
                                httpOnly: true
                            }
                        });
                    }

                    // Success - redirect to dashboard after session is saved
                    // Note: express-session should automatically set the cookie in the redirect response
                    res.redirect(`${frontendUrl}/dashboard`);
                });
            });
        })(req, res, next);
    }
);

// @desc    Logout user
// @route   GET /api/auth/logout
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        let frontendUrl = process.env.FRONTEND_URL;
        // Enforce HTTPS in production
        if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
            frontendUrl = frontendUrl.replace('http://', 'https://');
        }
        res.redirect(`${frontendUrl}/login`);
    });
});

// @desc    Logout user (POST support)
// @route   POST /api/auth/logout
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

// @desc    Get current user
// @route   GET /api/auth/me
router.get('/me', authCheckLimiter, (req, res) => {
    // Log session info for debugging (production only)
    if (process.env.NODE_ENV === 'production') {
        console.log('[Auth Check] /me endpoint:', {
            hasSession: !!req.session,
            sessionID: req.sessionID || 'none',
            isAuthenticated: req.isAuthenticated(),
            hasCookie: !!req.headers.cookie
        });
    }

    if (req.isAuthenticated()) {
        // Include onboarding status in user response
        const userResponse = {
            ...req.user.toObject ? req.user.toObject() : req.user,
            onboardingCompleted: req.user.onboardingCompleted || false,
            onboardingCompletedAt: req.user.onboardingCompletedAt || null
        };
        res.json({
            isAuthenticated: true,
            user: userResponse
        });
    } else {
        // Return 200 with null user to avoid browser console errors (User Preference)
        res.status(200).json({
            isAuthenticated: false,
            user: null
        });
    }
});

// @desc    Session test endpoint (for debugging)
// @route   GET /api/auth/session-test
router.get('/session-test', (req, res) => {
    const sessionInfo = {
        hasSession: !!req.session,
        sessionID: req.sessionID || null,
        isAuthenticated: req.isAuthenticated(),
        user: req.isAuthenticated() ? {
            id: req.user._id,
            email: req.user.email,
            displayName: req.user.displayName
        } : null,
        cookies: {
            hasCookie: !!req.headers.cookie,
            cookieCount: req.headers.cookie ? req.headers.cookie.split(';').length : 0
        },
        sessionData: req.session ? {
            cookie: req.session.cookie,
            passport: req.session.passport
        } : null
    };

    res.json({
        success: true,
        message: 'Session test endpoint',
        ...sessionInfo
    });
});

// @desc    Mark onboarding as completed
// @route   POST /api/auth/onboarding/complete
router.post('/onboarding/complete', async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
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
        console.error('Error marking onboarding as complete:', error.message);
        res.status(500).json({ success: false, message: 'Failed to mark onboarding as complete' });
    }
});

// @desc    Register new user
// @route   POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
    try {
        const { email, password, name } = req.body;

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await User.create({
            email,
            password: hashedPassword,
            displayName: name
        });

        req.login(user, (err) => {
            if (err) return next(err);
            const token = Buffer.from(user.id).toString('base64');
            res.status(201).json({ success: true, user, token });
        });
    } catch (err) {
        next(err);
    }
});

// @desc    Login user
// @route   POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.password) {
            return res.status(401).json({ success: false, message: 'Please login with Google' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        req.login(user, (err) => {
            if (err) return next(err);
            const token = Buffer.from(user.id).toString('base64');
            res.json({ success: true, user, token });
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
