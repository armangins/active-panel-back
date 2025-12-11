const wooService = require('../services/wooService');

const mediaController = {
    uploadMedia: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await wooService.uploadMedia(req.user._id, req.file);
            res.status(201).json(result);
        } catch (error) {
            if (error.message === 'WooCommerce settings not configured') {
                return res.status(200).json({
                    success: false,
                    code: 'SETUP_REQUIRED',
                    message: 'Please configure WooCommerce settings first.'
                });
            }

            const status = error.response?.status || 500;
            res.status(status).json({
                success: false,
                message: error.message,
                details: error.response?.data
            });
        }
    }
};

module.exports = mediaController;
