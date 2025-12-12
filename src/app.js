const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Trust proxy - required for correct cookie handling behind reverse proxy (Render, etc.)
// This ensures Express correctly identifies HTTPS and sets secure cookies
app.set('trust proxy', 1);

if (!process.env.FRONTEND_URL) {
    console.error('FATAL ERROR: FRONTEND_URL is not defined in .env');
    process.exit(1);
}

// Normalize FRONTEND_URL (remove trailing slash for CORS matching)
// Enforce HTTPS in production
let frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
    console.warn('WARNING: FRONTEND_URL uses HTTP in production. Converting to HTTPS.');
    frontendUrl = frontendUrl.replace('http://', 'https://');
}

// Log frontend URL in production for debugging (without exposing sensitive info)
if (process.env.NODE_ENV === 'production') {
    console.log(`Frontend URL configured: ${frontendUrl}`);
}

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: frontendUrl,
    credentials: true,
    exposedHeaders: ['x-wp-total', 'x-wp-totalpages']
}));
app.use(express.json());
app.use(cookieParser()); // Parse cookies for refresh tokens
app.use(morgan('dev'));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for /api/auth/me (has its own more lenient limiter)
        return req.path === '/api/auth/me';
    }
});

// Apply general rate limiter to all routes
app.use(limiter);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Root Route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Active Panel API is running' });
});

// JWT Authentication - No sessions needed
// Passport is still used for Google OAuth, but without sessions
const passport = require('passport');

// Passport config (for Google OAuth only)
require('./config/passport')(passport);

// Passport middleware (without sessions)
app.use(passport.initialize());
// Note: passport.session() is NOT used with JWT

// Middleware
const { ensureAuth } = require('./middleware/auth');

// Routes
const apiRoutes = require('./routes/api');
const settingsRoutes = require('./routes/settings');
const authJwtRoutes = require('./routes/auth-jwt'); // New JWT routes
const authRoutes = require('./routes/auth'); // Keep old routes for Google OAuth (will migrate)

// Mount JWT Auth Routes FIRST (Public)
app.use('/api/auth', authJwtRoutes);

// Mount old auth routes for Google OAuth (temporary - will be migrated)
// These will be merged into auth-jwt.js later
app.use('/api/auth-legacy', authRoutes);

// Mount Protected Routes
app.use('/api', ensureAuth, apiRoutes);
app.use('/api', ensureAuth, settingsRoutes);

const PORT = process.env.PORT || 3000;
const connectDB = require('./config/database');
const { startCleanupJob } = require('./jobs/tokenCleanup');

if (require.main === module) {
    // Connect to Database then start server
    connectDB().then(() => {
        app.listen(PORT, () => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`Server running on port ${PORT}`);
            }

            // Start token cleanup job
            startCleanupJob();
            console.log('✅ JWT Authentication enabled');
            console.log('✅ Token cleanup job started');
        });
    });
}

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

module.exports = app;

