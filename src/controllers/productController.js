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

            // Cleanup: Delete images from Firebase Storage after successful WordPress import
            if (validatedData.images && Array.isArray(validatedData.images)) {
                const firebaseImageUrls = validatedData.images
                    .filter(img => img.src && img.src.includes('storage.googleapis.com'))
                    .map(img => img.src);
                
                if (firebaseImageUrls.length > 0) {
                    console.log(`Cleaning up ${firebaseImageUrls.length} Firebase Storage images for new product`);
                    const storageService = require('../services/storageService');
                    storageService.deleteFiles(firebaseImageUrls).catch(err => {
                        console.error('Background cleanup failed:', err);
                    });
                }
            }

            res.status(201).json({
                success: true,
                data: product
            });
        } catch (error) {
            console.error('Product creation error:', error.message);

            // Handle Zod validation errors (if productSchema was used)
            if (error.name === 'ZodError') {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
                }
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input: ' + error.errors[0].message,
                    errors: error.errors
                });
            }

            // Handle WooCommerce API errors
            if (error.response?.data) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('WooCommerce API error:', error.response.data);
                }
                return res.status(error.response.status || 500).json({
                    success: false,
                    message: error.response.data.message || 'Failed to create product',
                    data: error.response.data
                });
            }

            // Handle other errors
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
            console.time(`UPDATE_TOTAL_${productId}`);

            // SECURITY: Verify product exists and belongs to user's store before updating
            try {
                console.time(`UPDATE_VERIFY_${productId}`);
                const existingProduct = await wooService.getProduct(userId, productId);
                console.timeEnd(`UPDATE_VERIFY_${productId}`);
                
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

            console.time(`UPDATE_API_CALL_${productId}`);
            const product = await wooService.updateProduct(userId, productId, validatedData);
            console.timeEnd(`UPDATE_API_CALL_${productId}`);
            
            console.timeEnd(`UPDATE_TOTAL_${productId}`);

            // Cleanup: Delete images from Firebase Storage after successful WordPress import
            // WordPress has now downloaded and stored the images, so we don't need them in Firebase anymore
            if (validatedData.images && Array.isArray(validatedData.images)) {
                const firebaseImageUrls = validatedData.images
                    .filter(img => img.src && img.src.includes('storage.googleapis.com'))
                    .map(img => img.src);
                
                if (firebaseImageUrls.length > 0) {
                    console.log(`Cleaning up ${firebaseImageUrls.length} Firebase Storage images for product ${productId}`);
                    // Don't await - let cleanup happen in background
                    const storageService = require('../services/storageService');
                    storageService.deleteFiles(firebaseImageUrls).catch(err => {
                        console.error('Background cleanup failed:', err);
                    });
                }
            }

            res.status(200).json({
                success: true,
                data: product
            });
        } catch (error) {
            console.error('Product update error:', error.message);

            if (error.message === 'WooCommerce settings not configured') {
                return res.status(200).json({
                    success: false,
                    code: 'SETUP_REQUIRED',
                    message: 'Please configure WooCommerce settings first.'
                });
            }

            // Handle Zod validation errors (if productSchema was used)
            if (error.name === 'ZodError') {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
                }
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input: ' + error.errors[0].message,
                    errors: error.errors
                });
            }

            // Handle WooCommerce API errors
            if (error.response?.data) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('WooCommerce API error:', error.response.data);
                }
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
    },

    syncProductPrice: async (req, res) => {
        try {
            const productId = req.params.id;
            console.log(`🔄 [CONTROLLER] Syncing product price for ID: ${productId}`);

            const product = await wooService.syncVariableProductPrice(req.user._id, productId);

            console.log(`✅ [CONTROLLER] Product price synced successfully`);
            res.json(product);
        } catch (error) {
            console.error(`❌ [CONTROLLER] Sync failed:`, error.message);

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
