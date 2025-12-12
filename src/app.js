const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

if (!process.env.FRONTEND_URL) {
    console.error('FATAL ERROR: FRONTEND_URL is not defined in .env');
    process.exit(1);
}

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL,
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
});
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

app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/active-panel' }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // false for localhost
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'lax' is better for local dev than 'none' (which requires secure)
        maxAge: 24 * 60 * 60 * 1000 // 1 day
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
            console.log(`Server running on port ${PORT}`);
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

