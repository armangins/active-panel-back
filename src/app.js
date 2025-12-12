const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
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

const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const passport = require('passport');

// Passport config
require('./config/passport')(passport);

// Sessions
// Security: Require SESSION_SECRET in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.error('FATAL ERROR: SESSION_SECRET is required in production');
    process.exit(1);
}

// Parse frontend URL to extract domain for cookie configuration
const getCookieDomain = () => {
    if (process.env.NODE_ENV === 'production') {
        try {
            const url = new URL(frontendUrl);
            // For cross-origin, don't set domain - browser handles it
            // Only set domain if frontend and backend are on same domain
            return undefined; // Let browser handle domain automatically
        } catch (e) {
            return undefined;
        }
    }
    return undefined; // Development: no domain restriction
};

app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/active-panel',
        touchAfter: 24 * 3600 // Lazy session update (24 hours)
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true for HTTPS in production
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' required for cross-origin in production
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/', // Ensure cookie is available for all paths
        domain: getCookieDomain(), // undefined for cross-origin (browser handles it)
    },
    name: 'connect.sid', // Explicit session cookie name
    rolling: false, // Don't reset expiration on every request
    genid: function(req) {
        // Generate session ID
        return require('crypto').randomBytes(16).toString('hex');
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Middleware
const { ensureAuth } = require('./middleware/auth');

// Routes
const apiRoutes = require('./routes/api');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

// Mount Auth Routes FIRST (Public)
app.use('/api/auth', authRoutes);

// Mount Protected Routes
app.use('/api', ensureAuth, apiRoutes);
app.use('/api', ensureAuth, settingsRoutes);

const PORT = process.env.PORT || 3000;
const connectDB = require('./config/database');

if (require.main === module) {
    // Connect to Database then start server
    connectDB().then(() => {
        app.listen(PORT, () => {
            if (process.env.NODE_ENV === 'development') {
                console.log(`Server running on port ${PORT}`);
            }
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

