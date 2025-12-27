# Simple Product Upload - Detailed Flow

## Complete Simple Product Creation Flow

```mermaid
graph TD
    Start["User Fills Product Form"] --> FillDetails["Enter Product Details<br/>Name, Description, SKU"]
    FillDetails --> SetPrices["Set Pricing<br/>Regular Price, Sale Price"]
    SetPrices --> AddImages["Upload Product Images"]
    AddImages --> SetStock["Configure Stock<br/>Quantity, Status"]
    SetStock --> SelectCats["Select Categories"]
    SelectCats --> UserSave["User Clicks Save"]
    
    UserSave --> ValidateForm["Frontend Validation<br/>React Hook Form + Zod"]
    ValidateForm --> BuildData["Build Product Data<br/>buildProductData()"]
    
    BuildData --> PostProduct["POST /api/products<br/>Create Product"]
    PostProduct --> AuthCheck["Authentication Check<br/>ensureAuth Middleware"]
    AuthCheck --> RateLimit["Rate Limiting<br/>mutationLimiter"]
    RateLimit --> ValidateSchema["Schema Validation<br/>validate(productSchema)"]
    
    ValidateSchema --> Controller["productController.createProduct"]
    Controller --> Service["wooService.createProduct"]
    Service --> WCCall["WooCommerce API Call<br/>POST /wp-json/wc/v3/products"]
    
    WCCall --> WCSuccess{"Success?"}
    WCSuccess -->|Yes| ReturnData["Return Product Data<br/>{id, name, sku, prices}"]
    WCSuccess -->|No| HandleError["Error Handler<br/>Log and Return Error"]
    
    ReturnData --> UpdateUI["Update Frontend State"]
    UpdateUI --> InvalidateCache["Invalidate React Query Cache"]
    InvalidateCache --> ShowSuccess["Show Success Modal"]
    ShowSuccess --> End["Done"]
    
    HandleError --> ShowError["Show Error to User"]
    ShowError --> End
    
    style Start fill:#e3f2fd
    style BuildData fill:#bbdefb
    style PostProduct fill:#fff9c4
    style WCCall fill:#ffcc80
    style ShowSuccess fill:#c8e6c9
    style HandleError fill:#ffcdd2
```

## Detailed Step-by-Step Process

### Phase 1: User Input & Form Validation

```mermaid
sequenceDiagram
    participant User
    participant Form as Product Form
    participant RHF as React Hook Form
    participant Zod as Zod Schema
    
    User->>Form: Fill product name
    User->>Form: Enter description
    User->>Form: Set regular price
    User->>Form: Set sale price (optional)
    User->>Form: Upload images
    User->>Form: Set stock quantity
    User->>Form: Select categories
    
    User->>Form: Click "Save"
    Form->>RHF: handleSubmit()
    RHF->>Zod: Validate form data
    
    alt Validation Fails
        Zod-->>RHF: Validation errors
        RHF-->>Form: Display field errors
        Form-->>User: Show error messages
    else Validation Passes
        Zod-->>RHF: Valid data
        RHF->>RHF: onSubmit(data)
    end
```

### Phase 2: Data Transformation

```mermaid
sequenceDiagram
    participant VM as ViewModel
    participant Builder as productBuilders.js
    participant Sanitize as Security Utils
    
    VM->>VM: Map product_name to name
    VM->>Builder: buildProductData(formData)
    
    Builder->>Sanitize: sanitizeInput(name)
    Sanitize-->>Builder: Clean name
    
    Builder->>Sanitize: sanitizeInput(description)
    Sanitize-->>Builder: Clean description
    
    Builder->>Builder: Format prices to 2 decimals
    Builder->>Builder: Transform categories array
    Builder->>Builder: Format images array
    Builder->>Builder: Set stock management
    
    Builder-->>VM: Cleaned product data
    Note over VM: Ready for API call
```

### Phase 3: API Request Flow

```mermaid
sequenceDiagram
    participant VM as ViewModel
    participant API as productsAPI
    participant Axios as HTTP Client
    participant Backend as Backend Server
    
    VM->>API: productsAPI.create(productData)
    Note over API: Frontend service layer
    
    API->>Axios: POST /api/products
    Note over Axios: Add auth headers<br/>Add CSRF token
    
    Axios->>Backend: HTTP Request
    Note over Backend: Request received
    
    Backend->>Backend: CORS check
    Backend->>Backend: Parse JSON body
    Backend-->>Axios: Processing...
```

### Phase 4: Backend Processing

```mermaid
sequenceDiagram
    participant Router as Express Router
    participant Auth as ensureAuth
    participant Limiter as Rate Limiter
    participant Validate as Validation
    participant Controller as Product Controller
    
    Router->>Auth: Check authentication
    Auth->>Auth: Verify JWT token
    
    alt Not Authenticated
        Auth-->>Router: 401 Unauthorized
    else Authenticated
        Auth->>Limiter: Continue
        Limiter->>Limiter: Check rate limit
        
        alt Rate Limit Exceeded
            Limiter-->>Router: 429 Too Many Requests
        else Within Limit
            Limiter->>Validate: Continue
            Validate->>Validate: validate(productSchema)
            
            alt Validation Fails
                Validate-->>Router: 400 Bad Request
            else Valid
                Validate->>Controller: createProduct(req, res)
            end
        end
    end
```

### Phase 5: WooCommerce Integration

```mermaid
sequenceDiagram
    participant Controller as productController
    participant Service as wooService
    participant Settings as MongoDB Settings
    participant Encrypt as Encryption Service
    participant WC as WooCommerce API
    
    Controller->>Service: createProduct(userId, data)
    Service->>Settings: findOne({user: userId})
    Settings-->>Service: User settings
    
    Service->>Encrypt: decrypt(consumerKey)
    Encrypt-->>Service: Decrypted key
    
    Service->>Encrypt: decrypt(consumerSecret)
    Encrypt-->>Service: Decrypted secret
    
    Service->>Service: Create WC API instance
    Service->>WC: POST /wp-json/wc/v3/products
    Note over WC: WooCommerce processes<br/>Creates product in database
    
    WC-->>Service: Product created {id, ...}
    Service-->>Controller: Product data
    Controller-->>Controller: res.status(201).json(product)
```

### Phase 6: Response & UI Update

```mermaid
sequenceDiagram
    participant Backend as Backend
    participant Axios as HTTP Client
    participant API as productsAPI
    participant VM as ViewModel
    participant Cache as React Query
    participant UI as User Interface
    
    Backend-->>Axios: 201 Created + Product data
    Axios-->>API: Response
    API-->>VM: Product created
    
    VM->>Cache: invalidateQueries(['products'])
    Note over Cache: Clear cached product list
    
    VM->>VM: setShowSuccessModal(true)
    VM->>VM: setCreatedProductId(productId)
    
    VM-->>UI: Update state
    UI-->>UI: Show success modal
    UI-->>UI: Display product name
```

## Data Transformation Examples

### Input: Form Data
```javascript
{
  product_name: "Wireless Mouse",
  status: "publish",
  type: "simple",
  description: "High-quality wireless mouse",
  short_description: "Wireless mouse with ergonomic design",
  regular_price: "49.99",
  sale_price: "39.99",
  sku: "WM-001",
  manage_stock: true,
  stock_quantity: "100",
  stock_status: "instock",
  categories: [15, 23],
  images: [
    { id: 12345 },
    { id: 12346 }
  ]
}
```

### After buildProductData()
```javascript
{
  name: "Wireless Mouse",  // Mapped from product_name
  status: "publish",
  type: "simple",
  description: "High-quality wireless mouse",
  short_description: "Wireless mouse with ergonomic design",
  regular_price: "49.99",
  sale_price: "39.99",
  sku: "WM-001",
  manage_stock: true,
  stock_quantity: "100",
  stock_status: "instock",
  categories: [
    { id: 15 },
    { id: 23 }
  ],
  images: [
    { id: 12345 },
    { id: 12346 }
  ]
}
```

### After Backend Sanitization
```javascript
{
  name: "Wireless Mouse",  // XSS cleaned
  status: "publish",
  type: "simple",
  description: "High-quality wireless mouse",  // HTML stripped
  short_description: "Wireless mouse with ergonomic design",
  regular_price: "49.99",
  sale_price: "39.99",
  sku: "WM-001",  // Sanitized
  manage_stock: true,
  stock_quantity: "100",
  stock_status: "instock",
  categories: [
    { id: 15 },
    { id: 23 }
  ],
  images: [
    { id: 12345 },
    { id: 12346 }
  ]
}
```

### WooCommerce Response
```javascript
{
  id: 67890,
  name: "Wireless Mouse",
  slug: "wireless-mouse",
  permalink: "https://store.com/product/wireless-mouse",
  type: "simple",
  status: "publish",
  description: "High-quality wireless mouse",
  short_description: "Wireless mouse with ergonomic design",
  sku: "WM-001",
  price: "39.99",  // Current price (sale price)
  regular_price: "49.99",
  sale_price: "39.99",
  on_sale: true,
  stock_quantity: 100,
  stock_status: "instock",
  manage_stock: true,
  categories: [
    { id: 15, name: "Electronics", slug: "electronics" },
    { id: 23, name: "Accessories", slug: "accessories" }
  ],
  images: [
    {
      id: 12345,
      src: "https://store.com/wp-content/uploads/image1.jpg",
      name: "image1.jpg"
    },
    {
      id: 12346,
      src: "https://store.com/wp-content/uploads/image2.jpg",
      name: "image2.jpg"
    }
  ],
  date_created: "2025-12-17T18:00:00",
  date_modified: "2025-12-17T18:00:00"
}
```

## Validation Rules

### Frontend Validation (Zod Schema)
```javascript
productSchema = z.object({
  product_name: z.string().min(1, "Product name is required"),
  status: z.enum(['draft', 'publish', 'private', 'pending']),
  type: z.enum(['simple', 'variable', 'grouped', 'external']),
  regular_price: z.string().optional(),
  sale_price: z.string().optional(),
  sku: z.string().optional(),
  stock_quantity: z.string().optional(),
  categories: z.array(z.number()).optional(),
  images: z.array(z.object({ id: z.number() })).optional()
}).superRefine((data, ctx) => {
  // If status is 'publish' and type is 'simple'
  if (data.status === 'publish' && data.type === 'simple') {
    if (!data.regular_price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Regular price is required for published products',
        path: ['regular_price']
      });
    }
  }
});
```

### Backend Validation (Zod Schema)
```javascript
productSchema = z.object({
  name: z.string().min(1),  // Required
  type: z.enum(['simple', 'variable', 'grouped', 'external']),
  status: z.enum(['draft', 'publish', 'private', 'pending']),
  regular_price: priceSchema,  // Optional but validated format
  sale_price: priceSchema,
  sku: z.string().optional(),
  manage_stock: z.boolean().default(true),
  stock_quantity: z.union([z.string(), z.number(), z.null()]).optional()
});
```

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| **400 Bad Request** | Validation failed | Check required fields, price format |
| **401 Unauthorized** | Invalid/expired token | Re-authenticate user |
| **409 Conflict** | Duplicate SKU | Use unique SKU or leave empty |
| **429 Too Many Requests** | Rate limit exceeded | Wait before retrying |
| **500 Server Error** | WooCommerce issue | Check WooCommerce settings |

### Error Flow

```mermaid
graph TD
    Error["Error Occurs"] --> CheckType{"Error Type?"}
    
    CheckType -->|Validation| ShowField["Highlight Field<br/>Show Error Message"]
    CheckType -->|Auth| Redirect["Redirect to Login"]
    CheckType -->|Network| Retry["Show Retry Button"]
    CheckType -->|Server| Contact["Show Contact Support"]
    
    ShowField --> UserFix["User Corrects Input"]
    UserFix --> Resubmit["Resubmit Form"]
    
    Retry --> UserRetry["User Clicks Retry"]
    UserRetry --> Resubmit
    
    style Error fill:#ffcdd2
    style ShowField fill:#fff9c4
    style Resubmit fill:#c8e6c9
```

## Key Files in Flow

| Layer | File | Purpose |
|-------|------|---------|
| **UI** | `AddProductView.jsx` | Form display |
| **Logic** | `useAddProductViewModel.js` | Business logic |
| **Transform** | `productBuilders.js` | Data transformation |
| **Schema** | `product.js` (frontend) | Form validation |
| **API** | `woocommerce.js` | HTTP client |
| **Routes** | `api.js` | Route definitions |
| **Middleware** | `auth.js`, `validate.js`, `rateLimiter.js` | Security layers |
| **Controller** | `productController.js` | Request handling |
| **Service** | `wooService.js` | WooCommerce integration |
| **Schema** | `product.js` (backend) | API validation |

## Performance Considerations

### Frontend Optimizations
- **Form Validation:** Real-time validation with debouncing
- **Image Upload:** Compress before upload
- **Caching:** React Query with 15-minute stale time
- **Optimistic Updates:** Update UI before server confirmation

### Backend Optimizations
- **Rate Limiting:** Prevent abuse (10 requests/minute)
- **Connection Pooling:** Reuse database connections
- **Async Operations:** Non-blocking I/O
- **Error Logging:** Structured logging for debugging

## Security Measures

### Frontend Security
1. **Input Sanitization:** Remove HTML/script tags
2. **CSRF Protection:** Token validation
3. **XSS Prevention:** Escape user input
4. **File Upload:** Validate file types and sizes

### Backend Security
1. **Authentication:** JWT token verification
2. **Authorization:** User-specific data access
3. **Rate Limiting:** Prevent brute force
4. **Schema Validation:** Prevent injection attacks
5. **Encryption:** Secure credential storage

## Success Criteria

✅ Product created in WooCommerce  
✅ Product ID returned to frontend  
✅ UI updated with success message  
✅ Cache invalidated for fresh data  
✅ User can view product in list  

---

**Focus:** This diagram shows the complete simple product creation flow from form input to WooCommerce database.
