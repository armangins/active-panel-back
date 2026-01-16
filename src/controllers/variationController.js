const wooService = require('../services/wooService');

const variationController = {
    /**
     * GET /api/products/:productId/variations
     * Get all variations for a product
     */
    getAllVariations: async (req, res) => {
        try {
            console.log('🟡 [BACKEND-CONTROLLER] getAllVariations - Request received');
            console.log('🟡 [BACKEND-CONTROLLER] Product ID:', req.params.productId);

            const { variations, total } = await wooService.getVariations(
                req.user._id,
                req.params.productId,
                req.query
            );

            console.log('🟢 [BACKEND-CONTROLLER] getAllVariations - Success');
            console.log('🟢 [BACKEND-CONTROLLER] Total variations found:', variations ? variations.length : 0);
            
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
        console.log('🟡 [BACKEND-CONTROLLER] createVariation - STEP 1: Request received');
        console.log('🟡 [BACKEND-CONTROLLER] Product ID:', req.params.productId);
        console.log('🟡 [BACKEND-CONTROLLER] Request Body:', JSON.stringify(req.body, null, 2));
        console.log('🟡 [BACKEND-CONTROLLER] User ID:', req.user?._id);

        try {
            console.log('🟡 [BACKEND-CONTROLLER] createVariation - STEP 2: Calling wooService.createVariation');

            const variation = await wooService.createVariation(
                req.user._id,
                req.params.productId,
                req.body
            );

            console.log('🟢 [BACKEND-CONTROLLER] createVariation - STEP 3: Success from wooService');
            console.log('🟢 [BACKEND-CONTROLLER] Created variation:', JSON.stringify(variation, null, 2));

            res.status(201).json(variation);

            console.log('🟢 [BACKEND-CONTROLLER] createVariation - STEP 4: Response sent to client');
        } catch (error) {
            console.error('🔴 [BACKEND-CONTROLLER] createVariation - ERROR caught');
            console.error('🔴 [BACKEND-CONTROLLER] Error message:', error.message);
            console.error('🔴 [BACKEND-CONTROLLER] Error response data:', error.response?.data);
            console.error('🔴 [BACKEND-CONTROLLER] Error status:', error.response?.status);

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
