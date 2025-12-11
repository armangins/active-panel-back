const wooService = require('../services/wooService');

const categoryController = {
    getAllCategories: async (req, res) => {
        try {
            const { data, total, totalPages } = await wooService.getCategories(req.user._id, req.query);
            res.set('x-wp-total', total);
            res.set('x-wp-totalpages', totalPages);
            res.json(data);
        } catch (error) {
            handleError(res, error);
        }
    },

    getCategoryById: async (req, res) => {
        try {
            const category = await wooService.getCategory(req.user._id, req.params.id);
            res.json(category);
        } catch (error) {
            handleError(res, error);
        }
    },

    createCategory: async (req, res) => {
        try {
            const category = await wooService.createCategory(req.user._id, req.body);
            res.status(201).json(category);
        } catch (error) {
            handleError(res, error);
        }
    },

    updateCategory: async (req, res) => {
        try {
            const category = await wooService.updateCategory(req.user._id, req.params.id, req.body);
            res.json(category);
        } catch (error) {
            handleError(res, error);
        }
    },

    deleteCategory: async (req, res) => {
        try {
            const result = await wooService.deleteCategory(req.user._id, req.params.id);
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
    res.status(status).json({
        success: false,
        message: error.customMessage || error.message,
        details: error.response?.data
    });
};

module.exports = categoryController;
