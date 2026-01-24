const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // The ID from WooCommerce
    wooId: {
        type: Number,
        required: true,
        index: true
    },
    // Store the full raw object if needed, or specific fields
    number: String,
    status: {
        type: String,
        index: true
    },
    currency: String,
    date_created: {
        type: Date,
        index: true
    },
    date_modified: Date,
    total: {
        type: Number,
        required: true
    },
    customer_id: Number,
    billing: {
        first_name: String,
        last_name: String,
        email: String,
        phone: String,
        city: String,
        country: String
    },
    payment_method_title: String,
    line_items: [mongoose.Schema.Types.Mixed], // Keep flexible
    
    // Internal fields
    syncedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Composite index for efficient querying per user
orderSchema.index({ user: 1, wooId: 1 }, { unique: true });
orderSchema.index({ user: 1, date_created: -1 });

module.exports = mongoose.model('Order', orderSchema);
