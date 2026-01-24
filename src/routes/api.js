const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const customerController = require('../controllers/customerController');

const mediaController = require('../controllers/mediaController');
const variationController = require('../controllers/variationController');
const categoryController = require('../controllers/categoryController');
const attributeController = require('../controllers/attributeController');
const couponController = require('../controllers/couponController');
const reportsController = require('../controllers/reportsController');
const debugController = require('../controllers/debugController');
const { ensureAuth } = require('../middleware/auth');
const Busboy = require('busboy');
const {
    validateBatchVariations,
    validateProductId,
    validateVariationId,
    validateUpdateOrder
} = require('../middleware/validation');

// Custom Busboy Middleware for Firebase Functions
const handleUpload = (req, res, next) => {
    if (req.method !== 'POST') {
        return next();
    }

    const busboy = Busboy({ 
        headers: req.headers,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB limit
        }
    });

    const fileBuffer = [];
    let fileInfo = {};
    let fileCount = 0;

    busboy.on('file', (name, file, info) => {
        const { filename, encoding, mimeType } = info;
        
        if (!mimeType.startsWith('image/')) {
             file.resume(); // Skip file
             return res.status(400).json({ error: 'Only image files are allowed!' });
        }

        fileCount++;
        fileInfo = { 
            originalname: filename, 
            mimetype: mimeType, 
            encoding 
        };

        file.on('data', (data) => {
            fileBuffer.push(data);
        });
    });

    busboy.on('field', (fieldname, val) => {
        if (!req.body) req.body = {};
        req.body[fieldname] = val;
    });

    busboy.on('finish', () => {
        if (fileCount > 0 && fileBuffer.length > 0) {
            req.file = {
                buffer: Buffer.concat(fileBuffer),
                ...fileInfo
            };
            next();
        } else {
            // If no file was uploaded suitable for req.file
             if (fileCount === 0) {
                 // It might be a non-file request, but this route expects a file?
                 // Let controller handle 'No file uploaded'
                 next(); 
             } else {
                 next();
             }
        }
    });

    busboy.on('error', (err) => {
        console.error('Busboy Error:', err);
        // Handle "Unexpected end of form" gracefully if it still somehow happens
        if (err.message === 'Unexpected end of form') {
             res.status(400).json({ error: 'Upload failed: Data transfer interrupted. Please try again.' });
        } else {
             next(err);
        }
    });
    // CRITICAL: Firebase Functions Gen 2 (or just Cloud Functions) 
    // may have already read the body into req.rawBody.
    if (req.rawBody) {
        busboy.end(req.rawBody);
    } else {
        req.pipe(busboy);
    }
};
const { apiLimiter, mutationLimiter, batchLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { productSchema, variationSchema, updateProductSchema, updateVariationSchema } = require('../schemas/product');
const { categorySchema } = require('../schemas/category');
const { couponSchema } = require('../schemas/coupon');

const noCacheMiddleware = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', ''); // Disable ETag to prevent 304 responses
    req.headers['if-none-match'] = ''; // Clear client's ETag
    req.headers['if-modified-since'] = ''; // Clear modification check
    next();
};

// Apply general rate limiting to all API routes
router.use(apiLimiter);

// Product Routes

// Category Routes (Must be before /products/:id to avoid conflict)
router.get('/products/categories', ensureAuth, noCacheMiddleware, categoryController.getAllCategories);
router.get('/products/categories/:id', ensureAuth, categoryController.getCategoryById);
router.post('/products/categories', ensureAuth, mutationLimiter, validate(categorySchema), categoryController.createCategory);
router.put('/products/categories/:id', ensureAuth, mutationLimiter, validate(categorySchema), categoryController.updateCategory);
router.delete('/products/categories/:id', ensureAuth, categoryController.deleteCategory);

// Attribute Routes (Must be before /products/:id)
router.get('/products/attributes', ensureAuth, attributeController.getAllAttributes);
router.get('/products/attributes/:id/terms', ensureAuth, attributeController.getAttributeTerms);

router.get('/products', ensureAuth, productController.getAllProducts);
router.get('/products/:id', ensureAuth, productController.getProductById);
router.post('/products', ensureAuth, mutationLimiter, validate(productSchema), productController.createProduct);
router.post('/products/batch', ensureAuth, batchLimiter, productController.batchProducts);
router.post('/products/:id/sync', ensureAuth, mutationLimiter, productController.syncProductPrice);
router.put('/products/:id', ensureAuth, mutationLimiter, validate(updateProductSchema), productController.updateProduct);
router.delete('/products/:id', ensureAuth, productController.deleteProduct);

// Variation Routes (must come before generic product routes to avoid conflicts)
router.get('/products/:productId/variations',
    ensureAuth,
    validateProductId,
    variationController.getAllVariations
);

router.get('/products/:productId/variations/:id',
    ensureAuth,
    validateVariationId,
    variationController.getVariationById
);

router.post('/products/:productId/variations/batch',
    ensureAuth,
    batchLimiter,
    validateBatchVariations,
    variationController.batchVariations
);

router.post('/products/:productId/variations',
    ensureAuth,
    mutationLimiter,
    validate(variationSchema),
    variationController.createVariation
);

router.put('/products/:productId/variations/:id',
    ensureAuth,
    mutationLimiter,
    validate(updateVariationSchema),
    variationController.updateVariation
);

router.delete('/products/:productId/variations/:id',
    ensureAuth,
    mutationLimiter,
    validateVariationId,
    variationController.deleteVariation
);

// Order Routes
router.get('/orders', ensureAuth, orderController.getAllOrders);
router.get('/orders/:id', ensureAuth, orderController.getOrderById);
router.put('/orders/:id',
    ensureAuth,
    mutationLimiter,
    validateUpdateOrder,
    orderController.updateOrder
);
router.delete('/orders/:id',
    ensureAuth,
    mutationLimiter,
    orderController.deleteOrder
);

// Customer Routes
router.get('/customers', ensureAuth, customerController.getAllCustomers);
router.get('/customers/:id', ensureAuth, customerController.getCustomerById);

// Media Routes
router.post('/media', ensureAuth, handleUpload, mediaController.uploadMedia);
router.post('/media/sideload', ensureAuth, mutationLimiter, mediaController.sideloadMedia);

// Category Routes (with no-cache for debugging)



// Coupon Routes
router.get('/coupons', ensureAuth, couponController.getAllCoupons);
router.get('/coupons/:id', ensureAuth, couponController.getCouponById);
router.post('/coupons', ensureAuth, mutationLimiter, validate(couponSchema), couponController.createCoupon);
router.put('/coupons/:id', ensureAuth, mutationLimiter, validate(couponSchema), couponController.updateCoupon);
router.delete('/coupons/:id', ensureAuth, couponController.deleteCoupon);

// Reports Routes
router.get('/dashboard', ensureAuth, reportsController.getDashboardSummary);
router.get('/reports/revenue', ensureAuth, reportsController.getRevenueByPeriod);
// router.get('/reports/customers', ensureAuth, reportsController.getCustomerTotals);
// router.get('/reports/sales', ensureAuth, reportsController.getSales);
// router.get('/reports/orders/totals', ensureAuth, reportsController.getOrderTotals);

// Debug Route


// Force redeploy: 2026-01-11 19:50
module.exports = router;
