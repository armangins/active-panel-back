/**
 * Seed Script - Create Demo Products
 * 
 * This script creates demo products for testing purposes.
 * Run with: node scripts/seedProducts.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// You'll need to get a valid auth token first
// For testing, you can temporarily disable auth or use a valid session

// Demo products data - matches your product schema exactly
const demoProducts = {
    simple: {
        name: 'Demo Simple Product',
        type: 'simple',
        status: 'publish',
        description: 'This is a demo simple product created for testing. It includes all standard fields.',
        short_description: 'Demo simple product for testing',
        regular_price: '99.99',
        sale_price: '79.99',
        sku: 'DEMO-SIMPLE-001',
        manage_stock: true,
        stock_quantity: 50,
        stock_status: 'instock',
        categories: [{ id: 15 }], // Update this to match your actual category ID
        images: [], // Add image IDs if you have uploaded images
        virtual: false,
        date_on_sale_from: null,
        date_on_sale_to: null,
        weight: '1.5',
        dimensions: {
            length: '10',
            width: '8',
            height: '5'
        },
        shipping_class: '',
        tax_status: 'taxable',
        tax_class: ''
    },

    variable: {
        name: 'Demo Variable T-Shirt',
        type: 'variable',
        status: 'publish',
        description: 'This is a demo variable product with Color and Size variations.',
        short_description: 'Demo variable t-shirt with multiple options',
        sku: 'DEMO-VAR-TSHIRT',
        manage_stock: false, // Variable products don't manage stock at parent level
        stock_quantity: null,
        categories: [{ id: 15 }], // Update this to match your actual category ID
        images: [],
        virtual: false,
        date_on_sale_from: null,
        date_on_sale_to: null,
        weight: '',
        dimensions: {
            length: '',
            width: '',
            height: ''
        },
        shipping_class: '',
        tax_status: 'taxable',
        tax_class: '',
        attributes: [
            {
                id: 1, // ✅ Colors attribute (pa_colors)
                name: 'Color',
                options: ['Red', 'Blue', 'Green'],
                variation: true,
                visible: true
            },
            {
                id: 2, // ✅ Size attribute
                name: 'Size',
                options: ['Small', 'Medium', 'Large'],
                variation: true,
                visible: true
            }
        ]
    }
};

// Demo variations - matches your variation schema
const demoVariations = [
    {
        regular_price: '29.99',
        sale_price: '',
        sku: 'DEMO-TSHIRT-RED-S',
        manage_stock: true,
        stock_quantity: 10,
        attributes: [
            { id: 1, name: 'Color', option: 'Red' },
            { id: 2, name: 'Size', option: 'Small' }
        ]
    },
    {
        regular_price: '29.99',
        sale_price: '24.99',
        sku: 'DEMO-TSHIRT-RED-M',
        manage_stock: true,
        stock_quantity: 15,
        attributes: [
            { id: 1, name: 'Color', option: 'Red' },
            { id: 2, name: 'Size', option: 'Medium' }
        ]
    },
    {
        regular_price: '34.99',
        sale_price: '',
        sku: 'DEMO-TSHIRT-BLUE-L',
        manage_stock: true,
        stock_quantity: 8,
        attributes: [
            { id: 1, name: 'Color', option: 'Blue' },
            { id: 2, name: 'Size', option: 'Large' }
        ]
    },
    {
        regular_price: '32.99',
        sale_price: '',
        sku: 'DEMO-TSHIRT-GREEN-M',
        manage_stock: true,
        stock_quantity: 12,
        attributes: [
            { id: 1, name: 'Color', option: 'Green' },
            { id: 2, name: 'Size', option: 'Medium' }
        ]
    }
];

async function createProducts() {
    console.log('🌱 Starting product seeding...\n');

    try {
        // Create simple product
        console.log('📦 Creating simple product...');
        const simpleProductResponse = await axios.post(`${API_URL}/products`, demoProducts.simple);
        const simpleProduct = simpleProductResponse.data.data || simpleProductResponse.data;
        console.log(`✅ Simple product created: ${simpleProduct.name} (ID: ${simpleProduct.id})\n`);

        // Create variable product
        console.log('📦 Creating variable product...');
        const variableProductResponse = await axios.post(`${API_URL}/products`, demoProducts.variable);
        const variableProduct = variableProductResponse.data.data || variableProductResponse.data;
        console.log(`✅ Variable product created: ${variableProduct.name} (ID: ${variableProduct.id})\n`);

        // Wait a bit for WooCommerce to process the parent product
        console.log('⏳ Waiting for WooCommerce to process parent product...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create variations for variable product
        console.log('🎨 Creating variations...');
        for (const variation of demoVariations) {
            try {
                const createdVariationResponse = await axios.post(
                    `${API_URL}/products/${variableProduct.id}/variations`,
                    variation
                );
                const createdVariation = createdVariationResponse.data.data || createdVariationResponse.data;
                console.log(`  ✅ Variation created: ${createdVariation.sku}`);
            } catch (varError) {
                console.error(`  ❌ Failed to create variation ${variation.sku}:`, varError.response?.data || varError.message);
            }
        }

        console.log('\n🎉 Seeding completed successfully!');
        console.log('\nCreated products:');
        console.log(`  - ${simpleProduct.name} (Simple) - ID: ${simpleProduct.id}`);
        console.log(`  - ${variableProduct.name} (Variable) - ID: ${variableProduct.id}`);
        console.log(`    └─ ${demoVariations.length} variations created`);

    } catch (error) {
        console.error('\n❌ Error seeding products:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        console.error('\n💡 Tips:');
        console.error('  - Make sure the backend server is running on http://localhost:3001');
        console.error('  - Update attribute IDs (1, 2) to match your WooCommerce attributes');
        console.error('  - Update category ID (15) to match your WooCommerce categories');
        console.error('  - Make sure you have Color and Size attributes set up in WooCommerce');
        process.exit(1);
    }
}

// Run the seeding
console.log('🚀 Demo Product Seeder\n');
console.log('This will create:');
console.log('  1. Simple Product: "Demo Simple Product"');
console.log('  2. Variable Product: "Demo Variable T-Shirt" with 4 variations\n');

createProducts();
