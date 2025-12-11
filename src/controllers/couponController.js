const wooService = require('../services/wooService');

const couponController = {
    getAllCoupons: async (req, res) => {
        try {
            const { data, total, totalPages } = await wooService.getCoupons(req.user._id, req.query);
            res.set('x-wp-total', total);
            res.set('x-wp-totalpages', totalPages);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    },

    getCouponById: async (req, res) => {
        try {
            // SECURITY: Validate coupon ID
            const couponId = parseInt(req.params.id, 10);
            if (isNaN(couponId) || couponId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coupon ID'
                });
            }
            
            const coupon = await wooService.getCoupon(req.user._id, couponId);
            res.json(coupon);
        } catch (error) {
            handleError(res, error);
        }
    },

    createCoupon: async (req, res) => {
        try {
            // SECURITY: Use validated data from middleware instead of raw req.body
            const couponData = req.validatedData || req.body;
            const coupon = await wooService.createCoupon(req.user._id, couponData);
            res.status(201).json(coupon);
        } catch (error) {
            handleError(res, error);
        }
    },

    updateCoupon: async (req, res) => {
        try {
            // SECURITY: Validate coupon ID
            const couponId = parseInt(req.params.id, 10);
            if (isNaN(couponId) || couponId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coupon ID'
                });
            }
            
            // SECURITY: Use validated data from middleware instead of raw req.body
            const couponData = req.validatedData || req.body;
            const coupon = await wooService.updateCoupon(req.user._id, couponId, couponData);
            res.json(coupon);
        } catch (error) {
            handleError(res, error);
        }
    },

    deleteCoupon: async (req, res) => {
        try {
            // SECURITY: Validate coupon ID
            const couponId = parseInt(req.params.id, 10);
            if (isNaN(couponId) || couponId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coupon ID'
                });
            }
            
            const result = await wooService.deleteCoupon(req.user._id, couponId);
            res.json(result);
        } catch (error) {
            handleError(res, error);
        }
    }
};

const handleError = (res, error) => {
    if (error.message === 'WooCommerce settings not configured') {
        return res.status(200).json({
            success: false,
            code: 'SETUP_REQUIRED',
            message: 'Please configure WooCommerce settings first.'
        });
    }
    const status = error.response?.status || 500;
    
    // SECURITY: Don't expose sensitive error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = error.customMessage || error.message || 'An error occurred';
    
    // SECURITY: Sanitize error message to prevent information leakage
    const sanitizedMessage = isDevelopment 
        ? errorMessage 
        : (errorMessage.includes('API') || errorMessage.includes('credentials') || errorMessage.includes('key')
            ? 'An error occurred while processing your request.'
            : errorMessage);
    
    res.status(status).json({
        success: false,
        message: sanitizedMessage,
        // Only include details in development mode
        ...(isDevelopment && error.response?.data ? { details: error.response.data } : {})
    });
};

module.exports = couponController;
