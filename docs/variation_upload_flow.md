# Variation Product Upload - Detailed Flow

## Complete Variation Creation Flow

```mermaid
graph TD
    Start["User Fills Product Form"] --> CheckType{"Product Type = Variable?"}
    CheckType -->|No| SimpleProduct["Create Simple Product"]
    CheckType -->|Yes| VarFlow["Variable Product Flow"]
    
    VarFlow --> SelectAttr["Select Attributes & Terms<br/>e.g., Color: Red, Blue<br/>Size: S, M, L"]
    SelectAttr --> GenVar["Generate Variations<br/>or Add Manually"]
    
    GenVar --> PendingList["Variations Added to<br/>Pending List"]
    PendingList --> UserSave["User Clicks Save"]
    
    UserSave --> BuildData["Build Product Data<br/>buildProductData()"]
    BuildData --> CreateParent["POST /api/products<br/>Create Parent Product"]
    
    CreateParent --> WaitWC["Wait 500ms<br/>for WooCommerce"]
    WaitWC --> GetID["Get Created Product ID"]
    
    GetID --> LoopStart{"More Pending<br/>Variations?"}
    LoopStart -->|Yes| CleanData["Clean Variation Data<br/>cleanVariationData()"]
    
    CleanData --> PostVar["POST /api/products/:id/variations<br/>Create Variation"]
    PostVar --> VarSuccess{"Success?"}
    
    VarSuccess -->|Yes| NextVar["Next Variation"]
    VarSuccess -->|No| ErrorLog["Log Error"]
    ErrorLog --> NextVar
    
    NextVar --> LoopStart
    LoopStart -->|No| SyncParent["Force Sync Parent<br/>Update Status to Trigger<br/>Price Recalculation"]
    
    SyncParent --> ReloadVar["Reload All Variations<br/>from WooCommerce"]
    ReloadVar --> ShowSuccess["Show Success Modal"]
    ShowSuccess --> End["Done"]
    
    SimpleProduct --> End
    
    style Start fill:#e3f2fd
    style VarFlow fill:#bbdefb
    style CreateParent fill:#fff9c4
    style PostVar fill:#ffcc80
    style ShowSuccess fill:#c8e6c9
    style ErrorLog fill:#ffcdd2
```

## Detailed Step-by-Step Process

### Phase 1: User Input & Preparation

```mermaid
sequenceDiagram
    participant User
    participant Form as Product Form
    participant VM as ViewModel
    participant Builder as productBuilders.js
    
    User->>Form: Fill product details
    User->>Form: Select "Variable" type
    User->>Form: Choose attributes (Color, Size)
    User->>Form: Select terms (Red, Blue, S, M)
    User->>Form: Click "Generate Variations"
    
    Form->>VM: handleGenerateVariations()
    VM->>VM: generateCombinations()
    Note over VM: Creates all combinations<br/>Red+S, Red+M, Blue+S, Blue+M
    
    VM->>Builder: buildVariationData()
    Builder-->>VM: Structured variation objects
    VM->>VM: Add to pendingVariations[]
    VM-->>Form: Display pending variations
    
    User->>Form: Click "Save Product"
    Form->>VM: handleSave('publish')
```

### Phase 2: Parent Product Creation

```mermaid
sequenceDiagram
    participant VM as ViewModel
    participant API as Frontend API
    participant Backend as Backend API
    participant WC as WooCommerce
    
    VM->>VM: buildProductData()
    Note over VM: Transform form data<br/>to WooCommerce format
    
    VM->>API: productsAPI.create(productData)
    API->>Backend: POST /api/products
    
    Backend->>Backend: ensureAuth middleware
    Backend->>Backend: validate(productSchema)
    Backend->>Backend: productController.createProduct
    
    Backend->>WC: POST /wp-json/wc/v3/products
    Note over WC: Create parent product<br/>with attributes defined
    
    WC-->>Backend: {id: 12345, ...}
    Backend-->>API: Product created
    API-->>VM: createdProductId = 12345
    
    VM->>VM: Wait 500ms
    Note over VM: Allow WooCommerce to<br/>complete internal processing
```

### Phase 3: Variation Creation Loop

```mermaid
sequenceDiagram
    participant VM as ViewModel
    participant Clean as cleanVariationData
    participant API as variationsAPI
    participant Backend as Backend
    participant WC as WooCommerce
    
    loop For each pending variation
        VM->>Clean: cleanVariationData(variation)
        Note over Clean: Remove temp IDs<br/>Format prices<br/>Sanitize SKU<br/>Clean attributes
        
        Clean-->>VM: Cleaned data
        
        VM->>API: variationsAPI.create(productId, data)
        Note over API: 🔵 Frontend log:<br/>Starting variation creation
        
        API->>Backend: POST /api/products/12345/variations
        
        Backend->>Backend: ensureAuth
        Backend->>Backend: mutationLimiter
        Backend->>Backend: validate(updateVariationSchema)
        Note over Backend: 🟡 Controller log:<br/>Request received
        
        Backend->>Backend: variationController.createVariation
        Backend->>Backend: wooService.createVariation
        Note over Backend: 🟠 Service log:<br/>Calling WooCommerce API
        
        Backend->>WC: POST /wp-json/wc/v3/products/12345/variations
        
        WC-->>Backend: {id: 67890, sku: "VAR-001", ...}
        Note over Backend: 🟢 Success log:<br/>Variation created
        
        Backend-->>API: Variation data
        Note over API: 🟢 Frontend log:<br/>Response received
        
        API-->>VM: Success
    end
```

### Phase 4: Finalization & Sync

```mermaid
sequenceDiagram
    participant VM as ViewModel
    participant API as Products API
    participant WC as WooCommerce
    
    Note over VM: All variations created
    
    VM->>VM: clearPendingVariations()
    VM->>VM: clearDeletedVariations()
    
    VM->>API: productsAPI.update(productId, {status})
    Note over API: Force sync to trigger<br/>WooCommerce price recalculation
    
    API->>WC: PUT /wp-json/wc/v3/products/12345
    WC-->>API: Updated product
    
    VM->>API: loadVariations(productId)
    Note over API: Reload fresh data<br/>from WooCommerce
    
    API->>WC: GET /wp-json/wc/v3/products/12345/variations
    WC-->>API: All variations with prices
    
    API-->>VM: Fresh variation data
    VM->>VM: setShowSuccessModal(true)
    Note over VM: Show success to user
```

## Data Transformation Examples

### Input: User Form Data
```javascript
{
  product_name: "T-Shirt",
  type: "variable",
  regular_price: "100",
  attributes: {
    1: [5, 6],  // Color: Red, Blue
    2: [8, 9]   // Size: S, M
  }
}
```

### After buildProductData()
```javascript
{
  name: "T-Shirt",
  type: "variable",
  regular_price: "100.00",
  attributes: [
    {
      id: 1,
      name: "Color",
      options: ["Red", "Blue"],
      variation: true,
      visible: true
    },
    {
      id: 2,
      name: "Size",
      options: ["S", "M"],
      variation: true,
      visible: true
    }
  ]
}
```

### Generated Variations (Pending)
```javascript
[
  {
    id: "temp-gen-1734456789-abc",
    attributes: { 1: 5, 2: 8 },  // Red + S
    regular_price: "100",
    sku: ""
  },
  {
    id: "temp-gen-1734456789-def",
    attributes: { 1: 5, 2: 9 },  // Red + M
    regular_price: "100",
    sku: ""
  },
  // ... more combinations
]
```

### After cleanVariationData()
```javascript
{
  // id removed (was temporary)
  regular_price: "100.00",
  sale_price: "",
  sku: "",
  manage_stock: true,
  stock_quantity: null,
  stock_status: "instock",
  attributes: [
    { id: 1, name: "Color", option: "Red" },
    { id: 2, name: "Size", option: "S" }
  ]
}
```

### WooCommerce Response
```javascript
{
  id: 67890,
  sku: "VAR-001",
  regular_price: "100.00",
  sale_price: "",
  stock_quantity: null,
  attributes: [
    { id: 1, name: "Color", option: "Red" },
    { id: 2, name: "Size", option: "S" }
  ]
}
```

## Error Handling Points

### 1. Validation Errors (Before WooCommerce)
- **Location:** Backend `validate` middleware
- **Schema:** `updateVariationSchema.partial()`
- **Common Issues:** Invalid price format, missing attributes

### 2. WooCommerce API Errors
- **Location:** `wooService.createVariation`
- **Common Issues:**
  - Duplicate SKU
  - Invalid attribute combination
  - Parent product not ready

### 3. Network Errors
- **Location:** Frontend API interceptors
- **Handling:** Retry logic, user-friendly messages

## Key Files in Flow

| Layer | File | Purpose |
|-------|------|---------|
| **UI** | `AddProductView.jsx` | Form display |
| **Logic** | `useAddProductViewModel.js` | Business logic, orchestration |
| **Transform** | `productBuilders.js` | Data transformation |
| **API** | `woocommerce.js` | HTTP client |
| **Routes** | `api.js` | Route definitions |
| **Controller** | `variationController.js` | Request handling |
| **Service** | `wooService.js` | WooCommerce integration |
| **Schema** | `product.js` | Validation schemas |

## Debug Log Flow

```
🔵 [FRONTEND] variationsAPI.create - Starting
  ↓
🟡 [BACKEND-CONTROLLER] createVariation - Request received
  ↓
🟠 [BACKEND-SERVICE] createVariation - Calling WooCommerce
  ↓
🟢 [BACKEND-SERVICE] WooCommerce success
  ↓
🟢 [BACKEND-CONTROLLER] Response sent
  ↓
🟢 [FRONTEND] Response received
```

---

**Focus:** This diagram specifically shows the variation product upload process from start to finish.
