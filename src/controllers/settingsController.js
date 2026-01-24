const Integration = require('../models/Integration');
const encryptionService = require('../config/encryption');
const wooService = require('../services/wooService');
const { pollUserOrders } = require('../jobs/orderPoller');
const security = require('../utils/security');

/**
 * Legacy Adapter Controller
 * Maps old /api/settings endpoints to the new Integration model
 */
const settingsController = {
    saveSettings: async (req, res) => {
        try {
            const { storeUrl, woocommerceUrl, consumerKey, consumerSecret, wordpressUsername, wordpressAppPassword } = req.body;
            const finalStoreUrl = storeUrl || woocommerceUrl;

            if (!finalStoreUrl || !consumerKey || !consumerSecret) {
                return res.status(400).json({ error: 'WooCommerce credentials are required' });
            }

            // SSRF Protection
            try {
                await security.validatePublicUrl(finalStoreUrl);
            } catch (err) {
                return res.status(400).json({ error: `Security Error: ${err.message}` });
            }

            const encryptedKey = encryptionService.encrypt(consumerKey);
            const encryptedSecret = encryptionService.encrypt(consumerSecret);

            let credentials = {
                storeUrl: finalStoreUrl,
                consumerKey: encryptedKey,
                consumerSecret: encryptedSecret
            };

            let integrationSettings = {};
            if (wordpressUsername) integrationSettings.wordpressUsername = wordpressUsername;
            if (wordpressAppPassword) {
                integrationSettings.wordpressAppPassword = encryptionService.encrypt(wordpressAppPassword);
            }

            // Find settings for THIS user and provider
            let integration = await Integration.findOne({ user: req.user._id, provider: 'woocommerce' }).select('+credentials');

            if (integration) {
                // Update
                for (const [key, value] of Object.entries(credentials)) {
                    integration.credentials.set(key, value);
                }
                for (const [key, value] of Object.entries(integrationSettings)) {
                    integration.settings.set(key, value);
                }
                integration.isActive = true;
                await integration.save();
            } else {
                // Create
                integration = await Integration.create({
                    user: req.user._id,
                    provider: 'woocommerce',
                    name: 'My Store',
                    credentials: credentials,
                    settings: integrationSettings,
                    isActive: true
                });
            }

            // INVALIDATE CACHE so next request uses new credentials
            wooService.clearCache(req.user._id.toString());
            
            // TRIGGER INITIAL SYNC (Products & Orders)
            console.log('🔄 [SYNC] Triggering initial sync for user', req.user._id);
            Promise.all([
                wooService.warmUserCache(req.user._id),
                pollUserOrders(req.user._id)
            ]).catch(err => console.error('❌ [SYNC] Initial sync failed:', err.message));

            res.json({
                message: 'Settings saved successfully',
                settings: {
                    storeUrl: finalStoreUrl,
                    hasConsumerKey: true,
                    hasConsumerSecret: true,
                    hasWordpressUsername: !!wordpressUsername,
                    hasWordpressAppPassword: !!wordpressAppPassword
                }
            });
        } catch (error) {
            console.error('Save Settings Error:', error);
            res.status(500).json({ error: error.message });
        }
    },

    getSettings: async (req, res) => {
        try {
            // Find settings for THIS user and provider
            // Need +credentials to check existence (even though we don't return values)
            const integration = await Integration.findOne({ 
                user: req.user._id, 
                provider: 'woocommerce' 
            }).select('+credentials');

            if (!integration) {
                return res.status(200).json({
                    settings: null
                });
            }

            // Construct response matching old format
            const storeUrl = integration.credentials.get('storeUrl');
            const hasKey = !!integration.credentials.get('consumerKey');
            const hasSecret = !!integration.credentials.get('consumerSecret');
            const hasUser = !!integration.settings.get('wordpressUsername');
            const hasPass = !!integration.settings.get('wordpressAppPassword');

            res.json({
                settings: {
                    storeUrl: storeUrl,
                    hasConsumerKey: hasKey,
                    hasConsumerSecret: hasSecret,
                    hasWordpressUsername: hasUser,
                    hasWordpressAppPassword: hasPass
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    testConnection: async (req, res) => {
        try {
            const { storeUrl, woocommerceUrl, consumerKey, consumerSecret } = req.body;
            const finalStoreUrl = storeUrl || woocommerceUrl;

            if (!finalStoreUrl || !consumerKey || !consumerSecret) {
                return res.status(400).json({ error: 'Missing credentials' });
            }

            // SSRF Check for test connection too!
            try {
                await security.validatePublicUrl(finalStoreUrl);
            } catch (err) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Security Error: ${err.message}` 
                });
            }

            const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
            const api = new WooCommerceRestApi({
                url: finalStoreUrl,
                consumerKey: consumerKey,
                consumerSecret: consumerSecret,
                version: "wc/v3"
            });

            // Try to fetch system status to verify connection
            await api.get("system_status");
            
            res.json({ success: true, message: 'Connection successful' });

        } catch (error) {
            console.error('Test Connection Failed:', error.message);
            res.status(400).json({ 
                success: false, 
                error: 'Connection failed. Please check your credentials.',
                details: error.message 
            });
        }
    },

    disconnectWooCommerce: async (req, res) => {
        try {
            const result = await Integration.deleteOne({ user: req.user._id, provider: 'woocommerce' });
            
            if (result.deletedCount > 0) {
                // INVALIDATE CACHE
                wooService.clearCache(req.user._id.toString());
            }
            
            res.json({ success: true, message: 'Disconnected successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = settingsController;
