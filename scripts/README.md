# Scripts

## Seed Products

Creates demo products for testing purposes.

### Usage

```bash
node scripts/seedProducts.js
```

### What it creates:

1. **Demo Simple Product**
   - Name: "Demo Simple Product"
   - SKU: DEMO-SIMPLE-001
   - Price: $99.99 (Sale: $79.99)
   - Stock: 50 units

2. **Demo Variable Product (T-Shirt)**
   - Name: "Demo T-Shirt (Variable)"
   - SKU: DEMO-VAR-TSHIRT
   - Attributes: Color (Red, Blue, Green), Size (Small, Medium, Large)
   - 3 Variations:
     - Red Small - $29.99
     - Red Medium - $29.99
     - Blue Large - $34.99

### Requirements

- Backend server must be running on `http://localhost:3001`
- You must be authenticated (or disable auth for testing)

### Customization

Edit `seedProducts.js` to:
- Change product data
- Add more products
- Modify variations
- Update category IDs
