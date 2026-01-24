const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const Integration = require('../src/models/Integration');
require('dotenv').config();

async function verify() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/active-panel');
        console.log('Connected to DB');

        const orderCount = await Order.countDocuments();
        console.log(`\n📊 VERIFICATION RESULT:`);
        console.log(`✅ Total Orders in Database: ${orderCount}`);
        
        if (orderCount > 0) {
            const sample = await Order.findOne().sort({ date_created: -1 });
            console.log(`🔍 Latest Order: #${sample.number} - ${sample.currency} ${sample.total} (${sample.status})`);
        } else {
            console.log('⚠️ No orders found. Sync might have failed.');
        }

        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verify();
