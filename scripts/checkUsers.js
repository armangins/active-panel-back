/**
 * Simple script to check users in the database
 * Usage: node scripts/checkUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/active-panel';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const checkUsers = async () => {
    try {
        await connectDB();
        
        const users = await User.find({}).select('email displayName googleId createdAt').sort({ createdAt: -1 });
        
        console.log('\n📊 Users in database:');
        console.log(`   Total users: ${users.length}\n`);
        
        if (users.length === 0) {
            console.log('   No users found in database.');
        } else {
            users.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.email}`);
                console.log(`      Display Name: ${user.displayName || 'N/A'}`);
                console.log(`      Google ID: ${user.googleId || 'N/A'}`);
                console.log(`      Created: ${user.createdAt}`);
                console.log('');
            });
        }
        
        // Check for Google users specifically
        const googleUsers = await User.find({ googleId: { $exists: true, $ne: null } });
        console.log(`\n🔐 Google OAuth users: ${googleUsers.length}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking users:', error);
        process.exit(1);
    }
};

checkUsers();
