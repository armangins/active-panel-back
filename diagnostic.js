const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Settings = require('./src/models/Settings');
const User = require('./src/models/User');

async function checkDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        console.log('\n--- Settings Collection Info ---');
        const settingsCount = await Settings.countDocuments();
        console.log(`Total settings documents: ${settingsCount}`);
        
        const allSettings = await Settings.find({}).limit(10);
        allSettings.forEach(s => {
            console.log(`Settings for user ID: ${s.user} (Type: ${typeof s.user})`);
            console.log(` - storeUrl: ${s.storeUrl ? 'PRESENT' : 'MISSING'}`);
            console.log(` - consumerKey: ${s.consumerKey ? 'PRESENT' : 'MISSING'}`);
            console.log(` - consumerSecret: ${s.consumerSecret ? 'PRESENT' : 'MISSING'}`);
        });

        console.log('\n--- Users with Settings ---');
        for (const s of allSettings) {
            const user = await User.findById(s.user);
            if (user) {
                console.log(`User: ${user.email} (ID: ${user._id}) has settings.`);
            } else {
                console.log(`Settings found for NON-EXISTENT user ID: ${s.user}`);
            }
        }

        console.log('\n--- Duplicate Emails Check ---');
        const emails = await User.aggregate([
            { $group: { _id: '$email', count: { $sum: 1 }, ids: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        if (emails.length > 0) {
            console.log('Found duplicate emails:');
            emails.forEach(e => console.log(`${e._id}: ${e.count} documents (${e.ids.join(', ')})`));
        } else {
            console.log('No duplicate emails found.');
        }

    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        await mongoose.connection.close();
    }
}

checkDatabase();
