const Settings = require('../models/Settings');
const encryptionService = require('../config/encryption');

const settingsController = {
    saveSettings: async (req, res) => {
        try {
            const { storeUrl, woocommerceUrl, consumerKey, consumerSecret, wordpressUsername, wordpressAppPassword } = req.body;
            const finalStoreUrl = storeUrl || woocommerceUrl;

            if (!finalStoreUrl || !consumerKey || !consumerSecret) {
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
                settings.storeUrl = finalStoreUrl;
                settings.consumerKey = encryptedKey;
                settings.consumerSecret = encryptedSecret;
                settings.wordpressUsername = wordpressUsername || null;
                settings.wordpressAppPassword = encryptedAppPassword;
                await settings.save();
            } else {
                settings = await Settings.create({
                    user: req.user._id,
                    storeUrl: finalStoreUrl,
                    consumerKey: encryptedKey,
                    consumerSecret: encryptedSecret,
                    wordpressUsername: wordpressUsername || null,
                    wordpressAppPassword: encryptedAppPassword
                });
            }

            res.json({
                message: 'Settings saved successfully',
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
    },

    getSettings: async (req, res) => {
        try {
            // Find settings for THIS user
            const settings = await Settings.findOne({ user: req.user._id });
            if (!settings) {
                // Return 200 with null settings instead of 404 - this is expected for new users
                return res.status(200).json({
                    settings: null
                });
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
