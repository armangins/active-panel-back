const jwt = require('./src/utils/jwt');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkJWT() {
    try {
        const mockUser = {
            _id: new mongoose.Types.ObjectId('69541605586f88af337c97cc'),
            email: 'armangins@gmail.com',
            role: 'user'
        };

        console.log('--- JWT Generation ---');
        const token = jwt.generateAccessToken(mockUser);
        console.log('Generated Token:', token.substring(0, 20) + '...');

        console.log('\n--- JWT Verification ---');
        const decoded = jwt.verifyAccessToken(token);
        console.log('Decoded Payload:', JSON.stringify(decoded, null, 2));

        if (decoded.userId === mockUser._id.toString()) {
            console.log('✅ userId matches toString() value.');
        } else {
            console.log('❌ userId mismatch!');
        }

    } catch (err) {
        console.error('JWT check failed:', err);
    }
}

checkJWT();
