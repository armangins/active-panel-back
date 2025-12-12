const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn('Google Auth Credentials missing. Authentication will not work.');
        return;
    }

    // Construct full callback URL for Google OAuth
    // Google requires absolute URLs with HTTPS in production
    let callbackURL = process.env.GOOGLE_CALLBACK_URL;
    
    if (!callbackURL) {
        // Use BACKEND_URL if provided, or construct from Render service URL
        if (process.env.BACKEND_URL) {
            // Ensure HTTPS
            const backendUrl = process.env.BACKEND_URL.replace(/^http:\/\//, 'https://');
            callbackURL = `${backendUrl}/api/auth/google/callback`;
        } else if (process.env.NODE_ENV === 'production') {
            // In production, use Render service URL with HTTPS
            // Render provides HTTPS by default
            callbackURL = 'https://active-panel-back.onrender.com/api/auth/google/callback';
        } else {
            // Development: use localhost with port from PORT env var or default 3000
            const port = process.env.PORT || 3000;
            callbackURL = `http://localhost:${port}/api/auth/google/callback`;
        }
    }
    
    // Ensure HTTPS in production
    if (process.env.NODE_ENV === 'production' && callbackURL.startsWith('http://')) {
        callbackURL = callbackURL.replace('http://', 'https://');
    }
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`Google OAuth Callback URL: ${callbackURL}`);
    }

    // Strategy for login - authenticates existing users OR auto-creates new users
    passport.use('google-login', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // First, check if user exists by Google ID
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // User exists with this Google ID - log them in
                    done(null, user);
                    return;
                }

                // User doesn't exist with this Google ID
                // Check if user exists by email (in case they signed up with email/password)
                const userByEmail = await User.findOne({ email: profile.emails[0].value });
                
                if (userByEmail) {
                    // User exists but didn't sign up with Google
                    // Don't auto-link accounts - require email/password login for security
                    done(null, false, { 
                        message: 'Account exists but was not created with Google. Please use email/password login.',
                        code: 'ACCOUNT_EXISTS_NOT_GOOGLE'
                    });
                    return;
                }

                // User doesn't exist at all - auto-create account and log them in
                // Ensure displayName is set (required field)
                const displayName = profile.displayName || 
                    `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() ||
                    profile.emails[0].value.split('@')[0] || 
                    'User';
                
                user = await User.create({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    displayName: displayName,
                    firstName: profile.name?.givenName || null,
                    lastName: profile.name?.familyName || null,
                    image: profile.photos?.[0]?.value || null
                });
                
                // Return the newly created user to be logged in
                done(null, user);
            } catch (err) {
                console.error('Google Login Strategy Error:', err.message);
                done(err, null);
            }
        }));

    // Strategy for signup - identical to login (auto-creates users and logs them in)
    // This provides clarity for users who prefer to click "Sign up" vs "Sign in"
    // Construct signup callback URL
    let signupCallbackURL = process.env.GOOGLE_SIGNUP_CALLBACK_URL;
    if (!signupCallbackURL) {
        if (process.env.BACKEND_URL) {
            const backendUrl = process.env.BACKEND_URL.replace(/^http:\/\//, 'https://');
            signupCallbackURL = `${backendUrl}/api/auth/google/signup/callback`;
        } else if (process.env.NODE_ENV === 'production') {
            signupCallbackURL = 'https://active-panel-back.onrender.com/api/auth/google/signup/callback';
        } else {
            // Development: use localhost with port from PORT env var or default 3000
            const port = process.env.PORT || 3000;
            signupCallbackURL = `http://localhost:${port}/api/auth/google/signup/callback`;
        }
    }
    
    // Ensure HTTPS in production
    if (process.env.NODE_ENV === 'production' && signupCallbackURL.startsWith('http://')) {
        signupCallbackURL = signupCallbackURL.replace('http://', 'https://');
    }
    
    // Log configuration for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
        const backendPort = process.env.PORT || 3000;
        console.log(`Google OAuth Signup Configuration:`);
        console.log(`   Backend PORT: ${backendPort}`);
        console.log(`   Callback URL: ${signupCallbackURL}`);
        console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID ? 'Set' : 'MISSING'}`);
        console.log(`   Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'MISSING'}`);
    }

    passport.use('google-signup', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: signupCallbackURL
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // First, check if user exists by Google ID
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // User exists with this Google ID - log them in
                    done(null, user);
                    return;
                }

                // User doesn't exist with this Google ID
                // Check if user exists by email (in case they signed up with email/password)
                const userByEmail = await User.findOne({ email: profile.emails[0].value });
                
                if (userByEmail) {
                    // User exists but didn't sign up with Google
                    // Don't auto-link accounts - require email/password login for security
                    done(null, false, { 
                        message: 'Account exists but was not created with Google. Please use email/password login.',
                        code: 'ACCOUNT_EXISTS_NOT_GOOGLE'
                    });
                    return;
                }

                // User doesn't exist at all - auto-create account and log them in
                // Ensure displayName is set (required field)
                const displayName = profile.displayName || 
                    `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() ||
                    profile.emails[0].value.split('@')[0] || 
                    'User';
                
                user = await User.create({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    displayName: displayName,
                    firstName: profile.name?.givenName || null,
                    lastName: profile.name?.familyName || null,
                    image: profile.photos?.[0]?.value || null
                });
                
                // Return the newly created user to be logged in
                done(null, user);
            } catch (err) {
                console.error('Google Signup Strategy Error:', err.message);
                // Pass the error to the callback route
                done(err, null);
            }
        }));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};
