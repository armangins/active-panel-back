const socketConfig = require('../config/socket');
const wooService = require('../services/wooService');
const Settings = require('../models/Settings');

// Polling intervals
const POLLING_INTERVAL = 60 * 1000; // 60 seconds
const ERROR_RETRY_INTERVAL = 30 * 1000; // 30 seconds

// Track last check times to avoid double processing
const lastCheckTimes = new Map();

/**
 * Poll orders for a specific user
 */
const pollUserOrders = async (userId) => {
    try {
        // Get the IO instance (might throw if not initialized, but we catch below)
        const io = socketConfig.getIo();
        
        // Check if user has active connections before doing heavy lifting
        // We look for rooms named `user_${userId}`
        const roomName = `user_${userId}`;
        const room = io.sockets.adapter.rooms.get(roomName);
        
        // If no active connections for this user, skip polling to save resources
        if (!room || room.size === 0) {
            // console.log(`[POLLER] Skipping user ${userId} (no active connections)`);
            return;
        }

        // Determine "since" time
        // If first run, default to checking last 5 minutes to be safe/catch up
        const lastCheck = lastCheckTimes.get(userId) || (Date.now() - 5 * 60 * 1000);
        
        // IMPORTANT: WooCommerce API expects ISO 8601 string
        // We add a small buffer (1s) to avoid overlapping edge cases
        const afterDate = new Date(lastCheck).toISOString();
        
        // console.log(`[POLLER] Checking user ${userId} for orders after ${afterDate}`);

        // Fetch orders modified after the last check
        // Note: 'date_created' is better for "new" orders, but 'after' param usually filters by date_created.
        const result = await wooService.getOrders(userId, {
            after: afterDate,
            per_page: 20,
            orderby: 'date',
            order: 'asc' // Oldest first, so we process them in order
        });

        const newOrders = result.data;

        if (newOrders && newOrders.length > 0) {
            console.log(`📦 [POLLER] Found ${newOrders.length} new orders for user ${userId}`);
            
            // Emit event specifically to this user's room
            io.to(roomName).emit('new_orders', newOrders);
            
            // Update last check time to the most recent order's creation time
            // safely handling potential date parsing
            const latestOrderDate = new Date(newOrders[newOrders.length - 1].date_created).getTime();
            lastCheckTimes.set(userId, latestOrderDate);
        } else {
            // update last check time to now if no orders found
            lastCheckTimes.set(userId, Date.now());
        }

    } catch (error) {
        console.error(`❌ [POLLER] Error polling for user ${userId}:`, error.message);
    }
};

/**
 * Main polling loop
 */
const startPolling = async () => {
    try {
        // Find all users who have configured settings
        // In a larger app, you might want to query only users with active socket sessions from Redis
        const settings = await Settings.find({}, 'user');
        
        for (const setting of settings) {
            if (setting.user) {
                await pollUserOrders(setting.user);
            }
        }
    } catch (error) {
        console.error('❌ [POLLER] Fatal error in polling loop:', error);
    } finally {
        // Schedule next run
        setTimeout(startPolling, POLLING_INTERVAL);
    }
};

// Start the loop
console.log('🚀 [POLLER] Background order polling initiated');
startPolling();

module.exports = {
   pollUserOrders // Export for manual triggering if needed
};
