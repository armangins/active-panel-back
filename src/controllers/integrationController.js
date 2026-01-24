const Integration = require('../models/Integration');
const encryptionService = require('../config/encryption');
const security = require('../utils/security');
const wooService = require('../services/wooService');
const { pollUserOrders } = require('../jobs/orderPoller');

const integrationController = {
    // GET /api/integrations
    listIntegrations: async (req, res) => {
        try {
            const integrations = await Integration.find({ user: req.user._id });
            // credentials are explicitly excluded by schema select: false
            res.json({ success: true, count: integrations.length, data: integrations });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // POST /api/integrations
    addIntegration: async (req, res) => {
        try {
            const { provider, name, data } = req.body;

            // Basic Validation
            if (!provider || !data) {
                return res.status(400).json({ success: false, error: 'Provider and data are required' });
            }

            // Sanitize Name
            const safeName = security.sanitizeName(name) || 'My Integration';

            // Provider-Specific Logic
            let credentials = {};
            let settings = {};

            if (provider === 'woocommerce') {
                const { storeUrl, consumerKey, consumerSecret } = data;
                
                if (!storeUrl || !consumerKey || !consumerSecret) {
                     return res.status(400).json({ success: false, error: 'Missing WooCommerce credentials' });
                }

                // SSRF Protection
                try {
                    await security.validatePublicUrl(storeUrl);
                } catch (err) {
                    return res.status(400).json({ success: false, error: `Security Error: ${err.message}` });
                }

                // Encrypt Secrets
                credentials = {
                    storeUrl: storeUrl, // Ensure protocol is present? validatePublicUrl handles protocol check
                    consumerKey: encryptionService.encrypt(consumerKey),
                    consumerSecret: encryptionService.encrypt(consumerSecret)
                };
            } else if (provider === 'google_drive') {
                // Placeholder for Google Drive logic
                 return res.status(501).json({ success: false, error: 'Google Drive integration not implemented yet' });
            } else {
                 return res.status(400).json({ success: false, error: 'Unsupported provider' });
            }

            // Upsert Logic (Enforce 1 per type for now per schema index)
            // We use findOneAndUpdate with upsert to handle race conditions better, or find/upd/create
            let integration = await Integration.findOne({ user: req.user._id, provider });

            if (integration) {
                // Update existing
                integration.name = safeName;
                integration.isActive = true;
                
                // Mongoose Map update
                for (const [key, value] of Object.entries(credentials)) {
                    integration.credentials.set(key, value);
                }
                await integration.save();
            } else {
                // Create new
                integration = await Integration.create({
                    user: req.user._id,
                    provider,
                    name: safeName,
                    credentials, // Mongoose casts object to Map
                    settings
                });
            }

            // Post-Save Actions (Sync)
            if (provider === 'woocommerce') {
                wooService.clearCache(req.user._id.toString());
                // Trigger Sync
                Promise.all([
                    wooService.warmUserCache(req.user._id),
                    pollUserOrders(req.user._id)
                ]).catch(err => console.error('Initial sync failed', err));
            }

            res.json({ success: true, message: 'Integration connected', data: integration });

        } catch (error) {
            console.error('Add Integration Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // DELETE /api/integrations/:id
    removeIntegration: async (req, res) => {
        try {
            // IDOR Protection: specific query for user ownership
            const result = await Integration.deleteOne({ 
                _id: req.params.id, 
                user: req.user._id 
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, error: 'Integration not found' });
            }

            // Clear Cache
            wooService.clearCache(req.user._id.toString());

            res.json({ success: true, message: 'Integration removed' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = integrationController;
