const wooService = require('../services/wooService');

const customerController = {
    getAllCustomers: async (req, res) => {
        try {
            const customers = await wooService.getCustomers(req.user._id, req.query);
            res.json(customers);
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

    getCustomerById: async (req, res) => {
        try {
            const customer = await wooService.getCustomer(req.user._id, req.params.id);
            res.json(customer);
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

module.exports = customerController;
