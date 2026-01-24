const mongoose = require('mongoose');
const Integration = require('../src/models/Integration');
const encryptionService = require('../src/config/encryption');
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
require('dotenv').config();

async function debugOrders() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/active-panel');
        console.log('Connected to DB\n');

        // Get the first active integration
        const integration = await Integration.findOne({ 
            provider: 'woocommerce',
            isActive: true 
        }).select('+credentials');

        if (!integration) {
            console.log('❌ No active WooCommerce integration found');
            process.exit(1);
        }

        console.log('✅ Found integration for user:', integration.user);

        // Decrypt credentials
        const storeUrl = integration.credentials.get('storeUrl');
        const consumerKey = encryptionService.decrypt(integration.credentials.get('consumerKey'));
        const consumerSecret = encryptionService.decrypt(integration.credentials.get('consumerSecret'));

        console.log('🔗 Store URL:', storeUrl);
        console.log('🔑 Consumer Key:', consumerKey.substring(0, 10) + '...\n');

        // Create API instance
        const api = new WooCommerceRestApi({
            url: storeUrl,
            consumerKey: consumerKey,
            consumerSecret: consumerSecret,
            version: "wc/v3"
        });

        // Fetch orders
        console.log('📡 Fetching orders from WooCommerce...\n');
        const response = await api.get("orders", {
            per_page: 5,
            orderby: 'date',
            order: 'desc'
        });

        console.log(`📦 Fetched ${response.data.length} orders\n`);
        console.log('=' .repeat(80));

        response.data.forEach((order, index) => {
            console.log(`\nOrder ${index + 1}:`);
            console.log('  ID:', order.id);
            console.log('  Number:', order.number);
            console.log('  Status:', order.status);
            console.log('  Total:', order.total);
            console.log('  Currency:', order.currency);
            console.log('  Date Created:', order.date_created);
            console.log('  Customer ID:', order.customer_id);
            console.log('  Billing:', {
                first_name: order.billing?.first_name,
                last_name: order.billing?.last_name,
                email: order.billing?.email
            });
            console.log('  Line Items Count:', order.line_items?.length || 0);
            if (order.line_items?.length > 0) {
                console.log('  First Item:', order.line_items[0].name);
            }
        });

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ Debug complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        process.exit(1);
    }
}

debugOrders();
