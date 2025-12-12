const wooService = require('../services/wooService');

const orderController = {
    getAllOrders: async (req, res) => {
        try {
            const { data, total, totalPages } = await wooService.getOrders(req.user._id, req.query);

            // Set pagination headers
            res.set('x-wp-total', total);
            res.set('x-wp-totalpages', totalPages);

            res.json(data);
        } catch (error) {
            if (error.message === 'WooCommerce settings not configured') {
                // Don't log expected error for new users without settings
                return res.status(200).json({
                    success: false,
                    code: 'SETUP_REQUIRED',
                    message: 'Please configure WooCommerce settings first.'
                });
            }
            console.error('[OrderController] Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    },

    getOrderById: async (req, res) => {
        try {
            const order = await wooService.getOrder(req.user._id, req.params.id);
            res.json(order);
        } catch (error) {
            if (error.message === 'WooCommerce settings not configured') {
                return res.status(200).json({
                    success: false,
                    code: 'SETUP_REQUIRED',
                    message: 'Please configure WooCommerce settings first.'
                });
            }
            res.status(500).json({ error: error.message });
        }
    },

    updateOrder: async (req, res) => {
        try {
            const order = await wooService.updateOrder(req.user._id, req.params.id, req.body);
            res.json(order);
        } catch (error) {
            if (error.message === 'WooCommerce settings not configured') {
                return res.status(200).json({
                    success: false,
                    code: 'SETUP_REQUIRED',
                    message: 'Please configure WooCommerce settings first.'
                });
            }
            res.status(500).json({ error: error.message });
        }
    },

    deleteOrder: async (req, res) => {
        try {
            const result = await wooService.deleteOrder(req.user._id, req.params.id);
            res.json(result);
        } catch (error) {
            if (error.message === 'WooCommerce settings not configured') {
                return res.status(200).json({
                    success: false,
                    code: 'SETUP_REQUIRED',
                    message: 'Please configure WooCommerce settings first.'
                });
            }
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = orderController;
