/**
 * Helper Script - Get WooCommerce IDs
 * 
 * This script fetches your actual attribute and category IDs
 * Run with: node scripts/getWooCommerceIds.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function getIds() {

    try {
        // Get attributes
        const attributesResponse = await axios.get(`${API_URL}/attributes`);
        const attributes = attributesResponse.data;

        attributes.forEach(attr => {

        });

        // Get attribute terms for each attribute
        for (const attr of attributes) {
            try {
                const termsResponse = await axios.get(`${API_URL}/attributes/${attr.id}/terms`);
                const terms = termsResponse.data;
                console.log(`\n   ${attr.name} (ID: ${attr.id}) terms:`);
                terms.forEach(term => {
                    console.log(`     - "${term.name}" (ID: ${term.id})`);
                });
            } catch (err) {
            }
        }

        // Get categories
        const categoriesResponse = await axios.get(`${API_URL}/categories`);
        const categories = categoriesResponse.data;

        categories.slice(0, 10).forEach(cat => {
            console.log(`   ID: ${cat.id} - Name: "${cat.name}"`);
        });

        if (categories.length > 10) {
            console.log(`   ... and ${categories.length - 10} more categories`);
        }

        // Provide recommendations


        // Find Color and Size attributes
        const colorAttr = attributes.find(a => a.name.toLowerCase().includes('color') || a.name.toLowerCase().includes('צבע'));
        const sizeAttr = attributes.find(a => a.name.toLowerCase().includes('size') || a.name.toLowerCase().includes('מידה'));

        if (colorAttr) {

        } else {
        }

        if (sizeAttr) {
        } else {
        }

        if (categories.length > 0) {
        }


    } catch (error) {
        console.error('\n❌ Error fetching IDs:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Message:', error.response.data);

            if (error.response.status === 401) {
                console.error('\n💡 Authentication required!');
                console.error('   You need to be logged in to fetch this data.');
                console.error('   Try one of these options:');
                console.error('   1. Log in to your app first, then run this script');
                console.error('   2. Temporarily disable auth in your backend');
                console.error('   3. Check WooCommerce admin directly:');
                console.error('      - Attributes: Products → Attributes');
                console.error('      - Categories: Products → Categories');
            }
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

console.log('🚀 WooCommerce ID Fetcher\n');
console.log('This will show you the IDs you need for seedProducts.js\n');

getIds();
