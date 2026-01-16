const { onRequest } = require('firebase-functions/v2/https');
const { app } = require('./src/app');
const connectDB = require('./src/config/database');

// Ensure DB is connected before handling requests
// In Cloud Functions, global scope runs on cold start.
// We can start the connection here.
connectDB();

// Export the Express app as a Cloud Function
// Region can be customized, e.g., setGlobalOptions({ region: 'europe-west1' });
exports.api = onRequest({ invoker: 'public' }, app);
