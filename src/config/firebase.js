const admin = require('firebase-admin');
const path = require('path');

// Prevent multiple initializations
if (!admin.apps.length) {
    try {
        // Load service account key from environment variable
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        
        if (!serviceAccountPath) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not defined in .env');
        }

        // Resolve path relative to project root (process.cwd())
        const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
        const serviceAccount = require(absolutePath);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // Use bucket name from env or hardcoded if consistent with frontend
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'active-panel.firebasestorage.app'
        });
        console.log('Firebase Admin initialized with Service Account');
    } catch (error) {
        console.error('Failed to load Firebase Service Account Key:', error.message);
        console.warn('Fallback: Initializing app with default/environment credentials (custom tokens may fail)');
        
        admin.initializeApp();
    }
}

const storage = admin.storage();
const db = admin.firestore();

module.exports = { admin, storage, db };
