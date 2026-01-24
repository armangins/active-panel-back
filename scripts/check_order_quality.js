const mongoose = require('mongoose');
const Order = require('../src/models/Order');
require('dotenv').config();

async function checkOrders() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/active-panel');
        
        console.log('📊 Order Statistics:\n');
        
        const total = await Order.countDocuments();
        console.log(`Total Orders: ${total}`);
        
        const withRevenue = await Order.countDocuments({ total: { $gt: 0 } });
        console.log(`Orders with Revenue (>0): ${withRevenue}`);
        
        const emptyOrders = await Order.countDocuments({ total: 0 });
        console.log(`Empty Orders (0 total): ${emptyOrders}\n`);
        
        console.log('📈 Revenue Summary:');
        const revenueStats = await Order.aggregate([
            {
                $match: { status: { $in: ['completed', 'processing'] } }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        if (revenueStats.length > 0) {
            console.log(`Total Revenue (completed/processing): ${revenueStats[0].totalRevenue} ILS`);
            console.log(`Valid Orders Count: ${revenueStats[0].count}`);
        }
        
        console.log('\n📋 Sample Orders:');
        const samples = await Order.find()
            .sort({ date_created: -1 })
            .limit(3)
            .select('number status total currency billing.first_name billing.last_name');
        
        samples.forEach(order => {
            console.log(`  #${order.number}: ${order.total} ${order.currency} - ${order.status} - ${order.billing?.first_name || 'N/A'} ${order.billing?.last_name || ''}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkOrders();
