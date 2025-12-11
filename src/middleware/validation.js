const { body, param, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Variation validation rules
const validateCreateVariation = [
    param('productId').isInt().withMessage('Invalid product ID'),
    body('regular_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Regular price must be a positive number'),
    body('sale_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Sale price must be a positive number'),
    body('stock_quantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Stock quantity must be a positive integer'),
    body('sku')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 100 })
        .withMessage('SKU must be a string with max 100 characters'),
    body('stock_status')
        .optional()
        .isIn(['instock', 'outofstock', 'onbackorder'])
        .withMessage('Invalid stock status'),
    body('attributes')
        .optional()
        .isArray()
        .withMessage('Attributes must be an array'),
    body('attributes.*.id')
        .optional()
        .isInt()
        .withMessage('Attribute ID must be an integer'),
    body('attributes.*.option')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Attribute option must be a non-empty string'),
    handleValidationErrors
];

const validateUpdateVariation = [
    param('productId').isInt().withMessage('Invalid product ID'),
    param('id').isInt().withMessage('Invalid variation ID'),
    body('regular_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Regular price must be a positive number'),
    body('sale_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Sale price must be a positive number'),
    body('stock_quantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Stock quantity must be a positive integer'),
    body('sku')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 100 })
        .withMessage('SKU must be a string with max 100 characters'),
    body('stock_status')
        .optional()
        .isIn(['instock', 'outofstock', 'onbackorder'])
        .withMessage('Invalid stock status'),
    handleValidationErrors
];

const validateBatchVariations = [
    param('productId').isInt().withMessage('Invalid product ID'),
    body('create')
        .optional()
        .isArray()
        .withMessage('Create must be an array'),
    body('update')
        .optional()
        .isArray()
        .withMessage('Update must be an array'),
    body('delete')
        .optional()
        .isArray()
        .withMessage('Delete must be an array'),
    // Limit batch size
    body().custom((value) => {
        const totalOps = (value.create?.length || 0) +
            (value.update?.length || 0) +
            (value.delete?.length || 0);
        if (totalOps > 50) {
            throw new Error('Batch operations limited to 50 items');
        }
        return true;
    }),
    handleValidationErrors
];

const validateProductId = [
    param('productId').isInt().withMessage('Invalid product ID'),
    handleValidationErrors
];

const validateVariationId = [
    param('productId').isInt().withMessage('Invalid product ID'),
    param('id').isInt().withMessage('Invalid variation ID'),
    handleValidationErrors
];

const validateUpdateOrder = [
    param('id').isInt().withMessage('Invalid order ID'),
    body('status')
        .optional()
        .isIn(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'])
        .withMessage('Invalid order status'),
    // Add other fields if needed, but strict validation is key
    handleValidationErrors
];

module.exports = {
    validateCreateVariation,
    validateUpdateVariation,
    validateBatchVariations,
    validateProductId,
    validateVariationId,
    validateUpdateOrder
};
