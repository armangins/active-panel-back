const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { loginSchema, registerSchema } = require('../schemas/auth');
const router = express.Router();

// @desc    Auth with Google
// @route   GET /api/auth/google
router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Google Auth Credentials missing in server configuration.' });
    }
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res, next);
});

// @desc    Google auth callback
// @route   GET /api/auth/google/callback
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: (() => {
            let url = process.env.FRONTEND_URL;
            // Enforce HTTPS in production
            if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
                url = url.replace('http://', 'https://');
            }
            return `${url}/login?error=true`;
        })()
    }),
    (req, res) => {
        // Successful authentication, redirect to frontend
        let frontendUrl = process.env.FRONTEND_URL;
        // Enforce HTTPS in production
        if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
            frontendUrl = frontendUrl.replace('http://', 'https://');
        }
        res.redirect(`${frontendUrl}/dashboard`);
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
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            isAuthenticated: true,
            user: req.user
        });
    } else {
        // Return 200 with null user to avoid browser console errors (User Preference)
        res.status(200).json({
            isAuthenticated: false,
            user: null
        });
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
