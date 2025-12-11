# How to Run the Seed Script

The seed script is ready with your correct IDs:
- ✅ Colors attribute: ID 1
- ✅ Size attribute: ID 2
- ✅ Category: ID 15

## Option 1: Run from Browser Console (Easiest)

1. **Log in to your app** at `http://localhost:5173`
2. **Open Developer Tools** (F12)
3. **Go to Console tab**
4. **Paste and run this code:**

```javascript
// Demo products with your correct IDs
const demoProducts = {
  simple: {
    name: 'Demo Simple Product',
    type: 'simple',
    status: 'publish',
    description: 'This is a demo simple product created for testing.',
    short_description: 'Demo simple product for testing',
    regular_price: '99.99',
    sale_price: '79.99',
    sku: 'DEMO-SIMPLE-001',
    manage_stock: true,
    stock_quantity: 50,
    stock_status: 'instock',
    categories: [{ id: 15 }],
    images: [],
    virtual: false,
    weight: '1.5',
    dimensions: { length: '10', width: '8', height: '5' },
    shipping_class: '',
    tax_status: 'taxable',
    tax_class: ''
  }
};

// Create simple product
fetch('http://localhost:3001/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(demoProducts.simple)
})
.then(r => r.json())
.then(data => console.log('✅ Product created:', data))
.catch(err => console.error('❌ Error:', err));
```

## Option 2: Use Your Frontend App

Just create a product manually in your app - the form is already working! 😊

## Option 3: Temporarily Disable Auth

In your backend, comment out the auth middleware for testing, then run:
```bash
node scripts/seedProducts.js
```

Which option would you prefer?
