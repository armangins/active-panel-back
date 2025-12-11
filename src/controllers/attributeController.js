const wooService = require('../services/wooService');

const attributeController = {
    getAllAttributes: async (req, res) => {
        try {
            const { data } = await wooService.getAttributes(req.user._id, req.query);
            res.json(data);
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
                message: error.customMessage || error.message,
                details: error.response?.data
            });
        }
    },

    getAttributeTerms: async (req, res) => {
        try {
            // req.params.id is the attribute ID
            const terms = await wooService.getAttributeTerms(req.user._id, req.params.id, req.query);
            res.json(terms);
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
                message: error.customMessage || error.message,
                details: error.response?.data
            });
        }
    }
};

module.exports = attributeController;
