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
                    // Start of Modification: Prevent auto-registration
                    // done(null, false) indicates authentication failure (user not found)
                    done(null, false, { message: 'No account found with this email.' });
                    // End of Modification
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
