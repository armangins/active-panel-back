const Settings = require('../models/Settings');
const encryptionService = require('../config/encryption');

const settingsController = {
    saveSettings: async (req, res) => {
        try {
            const { storeUrl, consumerKey, consumerSecret, wordpressUsername, wordpressAppPassword } = req.body;

            if (!storeUrl || !consumerKey || !consumerSecret) {
                return res.status(400).json({ error: 'WooCommerce credentials are required' });
            }

            const encryptedKey = encryptionService.encrypt(consumerKey);
            const encryptedSecret = encryptionService.encrypt(consumerSecret);

            // Encrypt WordPress App Password if provided
            const encryptedAppPassword = wordpressAppPassword ?
                encryptionService.encrypt(wordpressAppPassword) : null;

            // Find settings for THIS user
            let settings = await Settings.findOne({ user: req.user._id });

            if (settings) {
                settings.storeUrl = storeUrl;
                settings.consumerKey = encryptedKey;
                settings.consumerSecret = encryptedSecret;
                settings.wordpressUsername = wordpressUsername || null;
                settings.wordpressAppPassword = encryptedAppPassword;
                await settings.save();
            } else {
                await Settings.create({
                    user: req.user._id,
                    storeUrl,
                    consumerKey: encryptedKey,
                    consumerSecret: encryptedSecret,
                    wordpressUsername: wordpressUsername || null,
                    wordpressAppPassword: encryptedAppPassword
                });
            }

            res.json({ message: 'Settings saved successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getSettings: async (req, res) => {
        try {
            // Find settings for THIS user
            const settings = await Settings.findOne({ user: req.user._id });
            if (!settings) {
                return res.status(404).json({ error: 'Settings not found' });
            }

            // Return only non-sensitive data with flags
            res.json({
                settings: {
                    storeUrl: settings.storeUrl,
                    hasConsumerKey: !!settings.consumerKey,
                    hasConsumerSecret: !!settings.consumerSecret,
                    hasWordpressUsername: !!settings.wordpressUsername,
                    hasWordpressAppPassword: !!settings.wordpressAppPassword
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = settingsController;
