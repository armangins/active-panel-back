const wooService = require('../services/wooService');

const variationController = {
    /**
     * GET /api/products/:productId/variations
     * Get all variations for a product
     */
    getAllVariations: async (req, res) => {
        try {
            const { variations, total } = await wooService.getVariations(
                req.user._id,
                req.params.productId,
                req.query
            );

            // Set pagination header
            res.set('x-wp-total', total);
            res.json(variations);
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

    /**
     * GET /api/products/:productId/variations/:id
     * Get single variation by ID
     */
    getVariationById: async (req, res) => {
        try {
            const variation = await wooService.getVariation(
                req.user._id,
                req.params.productId,
                req.params.id
            );
            res.json(variation);
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

    /**
     * POST /api/products/:productId/variations
     * Create new variation
     */
    createVariation: async (req, res) => {
        try {
            const variation = await wooService.createVariation(
                req.user._id,
                req.params.productId,
                req.body
            );
            res.status(201).json(variation);
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

    /**
     * PUT /api/products/:productId/variations/:id
     * Update existing variation
     */
    updateVariation: async (req, res) => {
        try {
            const variation = await wooService.updateVariation(
                req.user._id,
                req.params.productId,
                req.params.id,
                req.body
            );
            res.json(variation);
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

    /**
     * DELETE /api/products/:productId/variations/:id
     * Delete variation
     */
    deleteVariation: async (req, res) => {
        try {
            const result = await wooService.deleteVariation(
                req.user._id,
                req.params.productId,
                req.params.id
            );
            res.json(result);
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

    /**
     * POST /api/products/:productId/variations/batch
     * Batch create/update/delete variations
     */
    batchVariations: async (req, res) => {
        try {
            const result = await wooService.batchVariations(
                req.user._id,
                req.params.productId,
                req.body
            );
            res.json(result);
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

module.exports = variationController;
