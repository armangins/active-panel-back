const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('../models/User');

module.exports = function (passport) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn('⚠️  Google Auth Credentials missing. Authentication will not work.');
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
            // Development: use relative path (Passport will construct from request)
            callbackURL = '/api/auth/google/callback';
        }
    }
    
    // Ensure HTTPS in production
    if (process.env.NODE_ENV === 'production' && callbackURL.startsWith('http://')) {
        callbackURL = callbackURL.replace('http://', 'https://');
    }
    
    console.log(`🔐 Google OAuth Callback URL: ${callbackURL}`);

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL
    },
        async (accessToken, refreshToken, profile, done) => {
            const newUser = {
                googleId: profile.id,
                displayName: profile.displayName,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                image: profile.photos[0].value,
                email: profile.emails[0].value
            };

            try {

                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    done(null, user);
                } else {
                    // User doesn't exist - prevent auto-registration
                    // Check if user exists by email (in case they signed up with email/password)
                    const userByEmail = await User.findOne({ email: profile.emails[0].value });
                    if (userByEmail) {
                        // User exists but didn't sign up with Google
                        done(null, false, { 
                            message: 'Account exists but was not created with Google. Please use email/password login.',
                            code: 'ACCOUNT_EXISTS_NOT_GOOGLE'
                        });
                    } else {
                        // No account found - user needs to sign up first
                        done(null, false, { 
                            message: 'No account found with this Google account. Please sign up first to create an account.',
                            code: 'NO_ACCOUNT_FOUND'
                        });
                    }
                }
            } catch (err) {
                console.error('Google Strategy Error:', err);
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
