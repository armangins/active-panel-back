const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/active-panel';
        
        if (!process.env.MONGODB_URI) {
            console.warn('Warning: MONGODB_URI not set, using default localhost');
        }

        // Check if it's MongoDB Atlas (mongodb+srv://)
        const isAtlas = mongoUri.includes('mongodb+srv://');
        
        // Connection options
        // For MongoDB Atlas (mongodb+srv://), SSL/TLS is handled automatically - no need to set TLS options
        const options = {
            // Connection pool options
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 15000, // Increased timeout for initial connection
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
            // Retry options
            retryWrites: true,
            retryReads: true,
            // For non-Atlas MongoDB connections, only use SSL if explicitly in URI
            ...(isAtlas ? {} : {
                ssl: mongoUri.includes('ssl=true') || mongoUri.includes('tls=true'),
            }),
        };

        // Disable Mongoose command buffering globally (operations fail immediately if not connected)
        mongoose.set('bufferCommands', false);

        if (process.env.NODE_ENV === 'development') {
            console.log(`Connecting to MongoDB...`);
        }
        
        const conn = await mongoose.connect(mongoUri, options);
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`MongoDB Connected: ${conn.connection.host}`);
        }
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        
        // Provide helpful error messages (development only)
        if (process.env.NODE_ENV === 'development') {
            if (error.message.includes('authentication failed')) {
                console.error('Tip: Check your MongoDB username and password in MONGODB_URI');
            } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
                console.error('Tip: Check your MongoDB host/URL in MONGODB_URI');
            } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
                console.error('Tip: For MongoDB Atlas, make sure:');
                console.error('   1. Your IP is whitelisted in MongoDB Atlas Network Access');
                console.error('   2. Your connection string uses mongodb+srv:// format');
                console.error('   3. Your database user has proper permissions');
            }
        }
        
        process.exit(1);
    }
};

module.exports = connectDB;
