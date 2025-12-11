const wooService = require('../services/wooService');

const productController = {
    getAllProducts: async (req, res) => {
        try {
            const { products, totalPages, totalProducts } = await wooService.getProducts(req.user._id, req.query);

            // Set pagination headers
            res.set('x-wp-total', totalProducts);
            res.set('x-wp-totalpages', totalPages);

            // Return just the products array
            res.json(products);
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

    getProductById: async (req, res) => {
        try {
            const product = await wooService.getProduct(req.user._id, req.params.id);
            res.json(product);
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

    createProduct: async (req, res) => {
        try {
            // SECURITY: Use validated data from middleware instead of raw req.body
            const validatedData = req.validatedData || req.body;

            const product = await wooService.createProduct(req.user._id, validatedData);

            res.status(201).json({
                success: true,
                data: product
            });
        } catch (error) {
            console.error('❌ Product creation error:', error);

            // Handle Zod validation errors (if productSchema was used)
            if (error.name === 'ZodError') {
                console.error('🔴 Validation errors:', JSON.stringify(error.errors, null, 2));
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input: ' + error.errors[0].message,
                    errors: error.errors
                });
            }

            // Handle WooCommerce API errors
            if (error.response?.data) {
                console.error('🔴 WooCommerce API error:', error.response.data);
                return res.status(error.response.status || 500).json({
                    success: false,
                    message: error.response.data.message || 'Failed to create product',
                    data: error.response.data
                });
            }

            // Handle other errors
            console.error('🔴 Unexpected error:', error.message);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create product'
            });
        }
    },

    updateProduct: async (req, res) => {
        try {
            const productId = req.params.id;
            const userId = req.user._id;

            // SECURITY: Verify product exists and belongs to user's store before updating
            try {
                const existingProduct = await wooService.getProduct(userId, productId);
                if (!existingProduct) {
                    return res.status(404).json({
                        success: false,
                        message: 'Product not found'
                    });
                }
            } catch (verifyError) {
                // If product doesn't exist or user doesn't have access, return 404
                if (verifyError.response?.status === 404) {
                    return res.status(404).json({
                        success: false,
                        message: 'Product not found'
                    });
                }
                // Re-throw other errors (like auth issues)
                throw verifyError;
            }

            // SECURITY: Use validated data from middleware instead of raw req.body
            const validatedData = req.validatedData || req.body;

            const product = await wooService.updateProduct(userId, productId, validatedData);

            res.status(200).json({
                success: true,
                data: product
            });
        } catch (error) {
            console.error('❌ Product update error:', error);

            if (error.message === 'WooCommerce settings not configured') {
                return res.status(200).json({
                    success: false,
                    code: 'SETUP_REQUIRED',
                    message: 'Please configure WooCommerce settings first.'
                });
            }

            // Handle Zod validation errors (if productSchema was used)
            if (error.name === 'ZodError') {
                console.error('🔴 Validation errors:', JSON.stringify(error.errors, null, 2));
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input: ' + error.errors[0].message,
                    errors: error.errors
                });
            }

            // Handle WooCommerce API errors
            if (error.response?.data) {
                console.error('🔴 WooCommerce API error:', error.response.data);
                // SECURITY: Don't expose full WooCommerce error details to client
                const status = error.response.status || 500;
                const errorMessage = error.response.data.message || 'Failed to update product';
                
                return res.status(status).json({
                    success: false,
                    message: errorMessage,
                    // Only include safe error details, not full response
                    ...(process.env.NODE_ENV === 'development' && { 
                        details: error.response.data 
                    })
                });
            }

            // Handle other errors
            console.error('🔴 Unexpected error:', error.message);
            const status = error.response?.status || 500;
            res.status(status).json({
                success: false,
                message: error.customMessage || error.message || 'Failed to update product',
                // SECURITY: Only expose error details in development
                ...(process.env.NODE_ENV === 'development' && { 
                    details: error.response?.data 
                })
            });
        }
    },

    deleteProduct: async (req, res) => {
        try {
            const result = await wooService.deleteProduct(req.user._id, req.params.id);
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
     * POST /api/products/batch
     * Batch create/update/delete products
     */
    batchProducts: async (req, res) => {
        try {
            const result = await wooService.batchProducts(req.user._id, req.body);
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

module.exports = productController;
