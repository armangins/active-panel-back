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
const { ensureAuth } = require('../middleware/auth');
const multer = require('multer');
const {

    validateBatchVariations,
    validateProductId,
    validateVariationId,
    validateUpdateOrder
} = require('../middleware/validation');
const { apiLimiter, mutationLimiter, batchLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { productSchema, variationSchema } = require('../schemas/product');
const { categorySchema } = require('../schemas/category');
const { couponSchema } = require('../schemas/coupon');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

const uploadMiddleware = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Upload Error:', err.message);
            return res.status(400).json({
                error: err.message,
                code: err.code || 'UPLOAD_ERROR'
            });
        }
        next();
    });
};

// Apply general rate limiting to all API routes
router.use(apiLimiter);

// Product Routes

// Attribute Routes (Must be before /products/:id)
router.get('/products/attributes', ensureAuth, attributeController.getAllAttributes);
router.get('/products/attributes/:id/terms', ensureAuth, attributeController.getAttributeTerms);

router.get('/products', ensureAuth, productController.getAllProducts);
router.get('/products/:id', ensureAuth, productController.getProductById);
router.post('/products', ensureAuth, mutationLimiter, validate(productSchema), productController.createProduct);
router.post('/products/batch', ensureAuth, batchLimiter, productController.batchProducts);
router.put('/products/:id', ensureAuth, mutationLimiter, validate(productSchema), productController.updateProduct);
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
    validate(variationSchema),
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

// Media Routes
router.post('/media', ensureAuth, upload.single('file'), mediaController.uploadMedia);

// Category Routes
router.get('/products/categories', ensureAuth, categoryController.getAllCategories);
router.get('/products/categories/:id', ensureAuth, categoryController.getCategoryById);
router.post('/products/categories', ensureAuth, mutationLimiter, validate(categorySchema), categoryController.createCategory);
router.put('/products/categories/:id', ensureAuth, mutationLimiter, validate(categorySchema), categoryController.updateCategory);
router.delete('/products/categories/:id', ensureAuth, categoryController.deleteCategory);

// Coupon Routes
router.get('/coupons', ensureAuth, couponController.getAllCoupons);
router.get('/coupons/:id', ensureAuth, couponController.getCouponById);
router.post('/coupons', ensureAuth, mutationLimiter, validate(couponSchema), couponController.createCoupon);
router.put('/coupons/:id', ensureAuth, mutationLimiter, validate(couponSchema), couponController.updateCoupon);
router.delete('/coupons/:id', ensureAuth, couponController.deleteCoupon);

module.exports = router;
