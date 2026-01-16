const socketConfig = require('../config/socket');
const wooService = require('../services/wooService');
const Settings = require('../models/Settings');

// Polling intervals
const POLLING_INTERVAL = 60 * 1000; // 60 seconds

// Track last check times to avoid double processing
const lastCheckTimes = new Map();

/**
 * Poll products for a specific user to check for low stock
 */
const pollUserProducts = async (userId) => {
    try {
        // Get the IO instance
        const io = socketConfig.getIo();
        
        // Check if user has active connections before doing heavy lifting
        const roomName = `user_${userId}`;
        const room = io.sockets.adapter.rooms.get(roomName);
        
        // If no active connections for this user, skip polling
        if (!room || room.size === 0) {
            return;
        }

        // Determine "since" time
        // If first run, default to checking last 5 minutes to be safe
        const lastCheck = lastCheckTimes.get(userId) || (Date.now() - 5 * 60 * 1000);
        
        // WooCommerce API expects ISO 8601 string
        const afterDate = new Date(lastCheck).toISOString();
        
        // Fetch products modified after the last check
        // We fetch fields relevant to stock management to keep payload light
        const result = await wooService.getProducts(userId, {
            modified_after: afterDate,
            per_page: 50, // Reasonable batch size
            _fields: 'id,name,sku,manage_stock,stock_quantity,stock_status,low_stock_amount,images,permalink'
        });

        const modifiedProducts = result.products;

        if (modifiedProducts && modifiedProducts.length > 0) {
            console.log(`📦 [STOCK-POLLER] Found ${modifiedProducts.length} modified products for user ${userId}`);
            
            const lowStockProducts = [];
            const outOfStockProducts = [];

            modifiedProducts.forEach(product => {
                // Only care if stock management is enabled
                if (!product.manage_stock) return;

                const currentStock = parseInt(product.stock_quantity, 10);
                
                // 1. OUT OF STOCK CHECK
                // Check if quantity is 0 or less, OR if status is explicitly 'outofstock'
                if (currentStock <= 0 || product.stock_status === 'outofstock') {
                    outOfStockProducts.push(product);
                    return; // Don't check for low stock if it's already out
                }

                // 2. LOW STOCK CHECK
                // Determine threshold: use product level override or default to 5
                const threshold = product.low_stock_amount !== null && product.low_stock_amount !== '' 
                    ? parseInt(product.low_stock_amount, 10) 
                    : 5;

                // Check if stock is at or below threshold (but positive)
                if (currentStock <= threshold) {
                    lowStockProducts.push(product);
                }
            });

            // Emit distinct events
            if (lowStockProducts.length > 0) {
                console.log(`⚠️ [STOCK-POLLER] Emitting LOW STOCK alert for ${lowStockProducts.length} products`);
                io.to(roomName).emit('low_stock_alert', lowStockProducts);
            }

            if (outOfStockProducts.length > 0) {
                console.log(`🚨 [STOCK-POLLER] Emitting OUT OF STOCK alert for ${outOfStockProducts.length} products`);
                io.to(roomName).emit('out_of_stock_alert', outOfStockProducts);
            }
            
            // Update last check time
            lastCheckTimes.set(userId, Date.now());
        } else {
            // update last check time to now if no products found
            lastCheckTimes.set(userId, Date.now());
        }

    } catch (error) {
        console.error(`❌ [STOCK-POLLER] Error polling for user ${userId}:`, error.message);
    }
};

/**
 * Main polling loop
 */
const startPolling = async () => {
    try {
        // Find all users who have configured settings
        const settings = await Settings.find({}, 'user');
        
        for (const setting of settings) {
            if (setting.user) {
                await pollUserProducts(setting.user);
            }
        }
    } catch (error) {
        console.error('❌ [STOCK-POLLER] Fatal error in polling loop:', error);
    } finally {
        // Schedule next run
        setTimeout(startPolling, POLLING_INTERVAL);
    }
};

// Start the loop
console.log('🚀 [STOCK-POLLER] Background stock polling initiated');
startPolling();

module.exports = {
   pollUserProducts
};
