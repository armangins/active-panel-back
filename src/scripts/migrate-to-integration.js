require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const Integration = require('../models/Integration');

const migrate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const settingsList = await Settings.find({});
        console.log(`Found ${settingsList.length} settings to migrate.`);

        let migratedCount = 0;

        for (const setting of settingsList) {
            // Check if already migrated
            const exists = await Integration.findOne({ 
                user: setting.user, 
                provider: setting.provider || 'woocommerce' 
            });

            if (exists) {
                console.log(`Skipping user ${setting.user} (Already migrated)`);
                continue;
            }

            console.log(`Migrating user ${setting.user}...`);

            const integration = new Integration({
                user: setting.user,
                provider: setting.provider || 'woocommerce',
                name: 'My Store', // Default name
                isActive: true,
                credentials: {}, // Will populate below
                settings: {}
            });

            // Populate Credentials (Encrypted strings)
            // Use Map API or object assignment? Mongoose Map requires .set usually or object init
            // Since we passed object in constructor, Mongoose casts it to Map
            
            // We need to verify if these fields exist
            if (setting.storeUrl) integration.credentials.set('storeUrl', setting.storeUrl);
            if (setting.consumerKey) integration.credentials.set('consumerKey', setting.consumerKey);
            if (setting.consumerSecret) integration.credentials.set('consumerSecret', setting.consumerSecret);
            
            // Populate Settings
            if (setting.wordpressUsername) integration.settings.set('wordpressUsername', setting.wordpressUsername);
            if (setting.wordpressAppPassword) integration.settings.set('wordpressAppPassword', setting.wordpressAppPassword);

            await integration.save();
            migratedCount++;
        }

        console.log(`Migration complete. Migrated ${migratedCount} documents.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
