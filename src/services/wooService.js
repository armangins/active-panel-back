const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const axios = require('axios');
const FormData = require('form-data');
const NodeCache = require('node-cache');
const Settings = require('../models/Settings');
const encryptionService = require('../config/encryption');

// In-memory cache for API instances and settings
const apiCache = new Map();
const settingsCache = new Map();
// Cache for product data (TTL: 5 minutes)
const productCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
// Dedicated cache for filter results (TTL: 5 minutes)
const filterCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Generate consistent cache key from filter parameters
 */
/**
 * Generate consistent cache key from filter parameters
 */
const generateCacheKey = (userId, params) => {
    const { search, category, type, stock_status, min_price, max_price, page, per_page } = params;
    // SECURITY: Include userId in cache key to prevent cross-user data leaks
    return `user:${userId}:filters:${search || ''}:${Array.isArray(category) ? category.sort().join(',') : category || ''}:${type || ''}:${stock_status || ''}:${min_price || ''}:${max_price || ''}:${page || 1}:${per_page || 24}`;
};

/**
 * Extract pagination information from WooCommerce response headers
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
};

/**
 * Extract pagination information from WooCommerce response headers
 */
const extractPagination = (response) => ({
    total: parseInt(response.headers['x-wp-total'] || response.data.length),
    totalPages: parseInt(response.headers['x-wp-totalpages'] || 1)
});

/**
 * Sanitize and format product data
 */
const prepareProductData = (data) => {
    const result = {
        ...data,
        name: data.name ? sanitizeString(data.name) : undefined,
        slug: data.slug ? sanitizeString(data.slug) : undefined,
        description: data.description ? sanitizeString(data.description) : undefined,
        short_description: data.short_description ? sanitizeString(data.short_description) : undefined,
        sku: data.sku ? sanitizeString(data.sku) : undefined,
    };

    // Only add date fields if they exist in the original data
    if ('date_on_sale_from' in data) {
        result.date_on_sale_from = data.date_on_sale_from ? `${data.date_on_sale_from}T00:00:00Z` : '';
    }
    if ('date_on_sale_to' in data) {
        result.date_on_sale_to = data.date_on_sale_to ? `${data.date_on_sale_to}T23:59:59Z` : '';
    }

    // Handle attributes if present
    if (data.attributes && Array.isArray(data.attributes)) {
        result.attributes = data.attributes.map(attr => ({
            ...attr,
            name: attr.name ? sanitizeString(attr.name) : attr.name,
            options: attr.options && Array.isArray(attr.options)
                ? attr.options.map(opt => sanitizeString(opt))
                : attr.options,
            option: attr.option ? sanitizeString(attr.option) : attr.option,
        }));
    }

    return result;
};

/**
 * Sanitize and format coupon data
 */
const prepareCouponData = (data) => ({
    ...data,
    code: data.code ? sanitizeString(data.code) : data.code,
    description: data.description ? sanitizeString(data.description) : data.description,
    amount: data.amount !== undefined ? (typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount) : undefined,
    minimum_amount: data.minimum_amount !== undefined ? (typeof data.minimum_amount === 'string' ? parseFloat(data.minimum_amount) : data.minimum_amount) : undefined,
    maximum_amount: data.maximum_amount !== undefined ? (typeof data.maximum_amount === 'string' ? parseFloat(data.maximum_amount) : data.maximum_amount) : undefined,
    usage_limit: data.usage_limit !== undefined ? (typeof data.usage_limit === 'string' ? parseInt(data.usage_limit, 10) : data.usage_limit) : undefined,
    usage_limit_per_user: data.usage_limit_per_user !== undefined ? (typeof data.usage_limit_per_user === 'string' ? parseInt(data.usage_limit_per_user, 10) : data.usage_limit_per_user) : undefined,
    email_restrictions: data.email_restrictions !== undefined && Array.isArray(data.email_restrictions)
        ? data.email_restrictions.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        : undefined
});

/**
 * Get or create WooCommerce API instance for a user
 */
const getApi = async (userId) => {
    // Check API instance cache
    if (apiCache.has(userId)) {
        return apiCache.get(userId);
    }

    // Fetch settings (check cache first)
    // Fetch settings (check cache first)
    let settings = settingsCache.get(userId);
    if (!settings) {
        settings = await Settings.findOne({ user: userId });
        if (!settings) {
            throw new Error('WooCommerce settings not configured');
        }
        settingsCache.set(userId, settings);
    }

    try {
        const consumerKey = encryptionService.decrypt(settings.consumerKey);
        const consumerSecret = encryptionService.decrypt(settings.consumerSecret);

        const api = new WooCommerceRestApi({
            url: settings.storeUrl,
            consumerKey: consumerKey,
            consumerSecret: consumerSecret,
            version: "wc/v3"
        });

        apiCache.set(userId, api);
        return api;
    } catch (err) {
        console.error('WooService: Decryption failed:', err.message);
        throw err;
    }
};

const wooService = {
    getProducts: async (userId, params = {}) => {
        // Use dedicated filter cache with better key generation
        const cacheKey = generateCacheKey(userId, params);
        const cachedData = filterCache.get(cacheKey);

        if (cachedData) {
            console.log('✅ Filter cache HIT:', cacheKey);
            return cachedData;
        }

        if (cachedData) {
            console.log('✅ Filter cache HIT:', cacheKey);
            return cachedData;
        }

        const api = await getApi(userId);

        const optimizedParams = {
            ...params,
            _fields: params._fields || 'id,name,type,status,description,short_description,stock_status,stock_quantity,price,regular_price,sale_price,price_html,images,categories,sku,date_on_sale_from,date_on_sale_to,on_sale,permalink'
        };

        const response = await api.get("products", optimizedParams);
        const pagination = extractPagination(response);

        const result = {
            products: response.data.map(product => ({
                ...product,
                variations: product.type === 'variable' ? [] : undefined
            })),
            totalPages: pagination.totalPages,
            totalProducts: pagination.total
        };

        // Store in filter cache
        filterCache.set(cacheKey, result);
        console.log('💾 Cached filter result:', cacheKey);
        return result;
    },

    getProduct: async (userId, id) => {
        try {
            const api = await getApi(userId);
            // SECURITY & ACCURACY: Only request regular_price, not price field (price may include tax)
            const response = await api.get(`products/${id}`, {
                _fields: 'id,name,type,status,description,short_description,sku,price,regular_price,sale_price,price_html,stock_quantity,stock_status,manage_stock,categories,images,attributes,tags,virtual,weight,dimensions,shipping_class,tax_status,tax_class,date_on_sale_from,date_on_sale_to,permalink'
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    createProduct: async (userId, data) => {
        productCache.flushAll();
        filterCache.flushAll(); // Clear filter cache when products change // Invalidate cache
        const prepareData = prepareProductData(data);
        console.log('🔍 [CREATE] Scheduled pricing data:', {
            date_on_sale_from: prepareData.date_on_sale_from,
            date_on_sale_to: prepareData.date_on_sale_to
        });
        const api = await getApi(userId);
        const response = await api.post("products", prepareData);

        return response.data;
    },

    updateProduct: async (userId, productId, data) => {
        productCache.flushAll(); // Invalidate cache
        filterCache.flushAll(); // Clear filter cache
        const prepareData = prepareProductData(data);
        const api = await getApi(userId);
        const response = await api.put(`products/${productId}`, prepareData);

        return response.data;
    },

    deleteProduct: async (userId, productId) => {
        productCache.flushAll();
        filterCache.flushAll(); // Clear filter cache when products change
        try {
            productCache.flushAll(); // Invalidate cache
            const api = await getApi(userId);
            // force: true is required to permanently delete instead of moving to trash
            const response = await api.delete(`products/${productId}`, { force: true });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    updateStock: async (userId, productId, quantity, status) => {
        productCache.flushAll(); // Invalidate cache
        try {
            const api = await getApi(userId);
            const data = {
                manage_stock: true,
                stock_quantity: quantity
            };
            if (status) {
                data.stock_status = status;
            }
            const response = await api.put(`products/${productId}`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    batchProducts: async (userId, data) => {
        productCache.flushAll(); // Invalidate cache
        const api = await getApi(userId);
        const response = await api.post('products/batch', data);
        return response.data;
    },

    syncVariableProductPrice: async (userId, productId) => {
        try {
            const api = await getApi(userId);

            // Strategy: harmless batch update to trigger WooCommerce internal sync mechanisms
            const batchData = {
                update: [
                    {
                        id: productId,
                        meta_data: [
                            {
                                key: '_price_sync_trigger',
                                value: Date.now().toString()
                            }
                        ]
                    }
                ]
            };

            await api.post('products/batch', batchData);

            // Wait for WooCommerce to process (recalculate prices)
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Fetch the updated product
            const response = await api.get(`products/${productId}`);
            return response.data;
        } catch (error) {
            console.error(`WooService: Sync failed for product ${productId}:`, error.message);
            throw error;
        }
    },

    uploadMedia: async (userId, file) => {
        try {
            // Get settings (check cache)
            let settings = settingsCache.get(userId);
            if (!settings) {
                settings = await Settings.findOne({ user: userId });
                if (!settings) throw new Error('WooCommerce settings not configured');
                settingsCache.set(userId, settings);
            }

            const baseUrl = settings.storeUrl.replace(/\/$/, '');
            const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

            // Priority 1: Try WordPress App Password (most reliable for media)
            if (settings.wordpressUsername && settings.wordpressAppPassword) {
                const appPassword = encryptionService.decrypt(settings.wordpressAppPassword);
                const auth = Buffer.from(`${settings.wordpressUsername}:${appPassword}`).toString('base64');

                const form = new FormData();
                form.append('file', file.buffer, {
                    filename: sanitizedFilename,
                    contentType: file.mimetype
                });

                const response = await axios.post(`${baseUrl}/wp-json/wp/v2/media`, form, {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Basic ${auth}`,
                        'User-Agent': 'Mozilla/5.0 (ActivePanel; Node.js)'
                    }
                });

                return response.data;
            }

            // Priority 2: Fallback to WooCommerce OAuth
            const api = await getApi(userId);
            const form = new FormData();
            form.append('file', file.buffer, {
                filename: sanitizedFilename,
                contentType: file.mimetype
            });

            const url = api.url + 'wp-json/wp/v2/media';
            const oauth = api._getOAuth().authorize({ url, method: 'POST' });
            const fullUrl = `${url}?${Object.keys(oauth).map(key => `${key}=${oauth[key]}`).join('&')}`;

            const response = await axios.post(fullUrl, form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (ActivePanel; Node.js)'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Media Upload Error:', error.response?.data?.message || error.message);
            if (error.response?.data?.message) {
                error.customMessage = `WooCommerce Error: ${error.response.data.message}`;
            }
            throw error;
        }
    },

    getOrders: async (userId, params = {}) => {
        const api = await getApi(userId);
        const response = await api.get("orders", params);
        const pagination = extractPagination(response);
        return {
            data: response.data,
            total: pagination.total,
            totalPages: pagination.totalPages
        };
    },

    getOrder: async (userId, orderId) => {
        const api = await getApi(userId);
        const response = await api.get(`orders/${orderId}`);
        return response.data;
    },

    updateOrder: async (userId, orderId, data) => {
        const api = await getApi(userId);
        const response = await api.put(`orders/${orderId}`, data);
        return response.data;
    },

    deleteOrder: async (userId, orderId) => {
        const api = await getApi(userId);
        const response = await api.delete(`orders/${orderId}`, { force: true });
        return response.data;
    },

    getCustomers: async (userId, params = {}) => {
        const api = await getApi(userId);
        const response = await api.get("customers", params);
        
        // Enrich each customer with completed orders count
        const customersWithCompletedOrders = await Promise.all(
            response.data.map(async (customer) => {
                try {
                    // Query orders for this customer with status=completed
                    const ordersResponse = await api.get("orders", {
                        customer: customer.id,
                        status: 'completed',
                        per_page: 1 // We only need the count, not the data
                    });
                    
                    // Extract total from headers
                    const completedOrdersCount = parseInt(ordersResponse.headers['x-wp-total'] || 0, 10);
                    
                    // Calculate average purchase
                    const totalSpent = customer.total_spent ? parseFloat(customer.total_spent) : 0;
                    const avgPurchase = completedOrdersCount > 0 && totalSpent > 0
                        ? (totalSpent / completedOrdersCount).toFixed(2)
                        : '0.00';
                    

                    
                    return {
                        ...customer,
                        completed_orders_count: completedOrdersCount,
                        avg_purchase: avgPurchase
                    };
                } catch (error) {
                    console.error(`Error fetching completed orders for customer ${customer.id}:`, error.message);
                    // Return customer with 0 completed orders on error
                    return {
                        ...customer,
                        completed_orders_count: 0,
                        avg_purchase: '0.00'
                    };
                }
            })
        );
        
        return customersWithCompletedOrders;
    },

    getCustomer: async (userId, customerId) => {
        const api = await getApi(userId);
        const response = await api.get(`customers/${customerId}`);
        
        try {
            // Query orders for this customer with status=completed
            const ordersResponse = await api.get("orders", {
                customer: customerId,
                status: 'completed',
                per_page: 1 // We only need the count, not the data
            });
            
            // Extract total from headers
            const completedOrdersCount = parseInt(ordersResponse.headers['x-wp-total'] || 0, 10);
            
            // Calculate average purchase
            const avgPurchase = completedOrdersCount > 0 && response.data.total_spent
                ? (parseFloat(response.data.total_spent) / completedOrdersCount).toFixed(2)
                : '0.00';
            
            return {
                ...response.data,
                completed_orders_count: completedOrdersCount,
                avg_purchase: avgPurchase
            };
        } catch (error) {
            console.error(`Error fetching completed orders for customer ${customerId}:`, error.message);
            // Return customer with 0 completed orders on error
            return {
                ...response.data,
                completed_orders_count: 0,
                avg_purchase: '0.00'
            };
        }
    },

    // ============================================
    // VARIATION MANAGEMENT
    // ============================================

    getVariations: async (userId, productId, params = {}) => {
        const api = await getApi(userId);
        const response = await api.get(`products/${productId}/variations`, {
            per_page: 100,
            _fields: params._fields || 'id,name,sku,regular_price,sale_price,stock_quantity,stock_status,manage_stock,image,attributes',
            ...params
        });
        const pagination = extractPagination(response);
        return {
            variations: response.data,
            total: pagination.total
        };
    },

    getVariation: async (userId, productId, variationId) => {
        const api = await getApi(userId);
        const response = await api.get(`products/${productId}/variations/${variationId}`);
        return response.data;
    },

    createVariation: async (userId, productId, data) => {
        productCache.flushAll(); // Invalidate cache - price range might change
        filterCache.flushAll(); // Clear filter cache when products change
        try {
            const api = await getApi(userId);
            const response = await api.post(`products/${productId}/variations`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    updateVariation: async (userId, productId, variationId, data) => {
        productCache.flushAll(); // Invalidate cache
        try {
            const api = await getApi(userId);
            const response = await api.put(`products/${productId}/variations/${variationId}`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    deleteVariation: async (userId, productId, variationId) => {
        productCache.flushAll(); // Invalidate cache
        try {
            const api = await getApi(userId);
            const response = await api.delete(`products/${productId}/variations/${variationId}`, {
                force: true
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    batchVariations: async (userId, productId, data) => {
        productCache.flushAll(); // Invalidate cache - prices/stock might change
        
        console.log('🔵 [BATCH-VARIATIONS] ========== START ==========');
        console.log('🔵 [BATCH-VARIATIONS] Product ID:', productId);
        console.log('🔵 [BATCH-VARIATIONS] User ID:', userId);
        console.log('🔵 [BATCH-VARIATIONS] Input Data:', JSON.stringify(data, null, 2));
        
        try {
            const api = await getApi(userId);
            
            console.log('🔵 [BATCH-VARIATIONS] Sending to WooCommerce API...');
            console.log('🔵 [BATCH-VARIATIONS] Endpoint:', `products/${productId}/variations/batch`);
            
            const response = await api.post(`products/${productId}/variations/batch`, data);
            
            console.log('🟢 [BATCH-VARIATIONS] SUCCESS - WooCommerce Response:');
            console.log('🟢 [BATCH-VARIATIONS] Status:', response.status || 'N/A');
            console.log('🟢 [BATCH-VARIATIONS] Response Data:', JSON.stringify(response.data, null, 2));
            console.log('🟢 [BATCH-VARIATIONS] ========== END ==========');
            
            return response.data;
        } catch (error) {
            console.error('🔴 [BATCH-VARIATIONS] ERROR occurred!');
            console.error('🔴 [BATCH-VARIATIONS] Error Message:', error.message);
            console.error('🔴 [BATCH-VARIATIONS] Error Response Status:', error.response?.status);
            console.error('🔴 [BATCH-VARIATIONS] Error Response Data:', JSON.stringify(error.response?.data, null, 2));
            console.error('🔴 [BATCH-VARIATIONS] ========== END (ERROR) ==========');
            throw error;
        }
    },

    // ============================================
    // CATEGORY MANAGEMENT
    // ============================================

    getCategories: async (userId, params = {}) => {

        
        const api = await getApi(userId);
        
        // Force 'count' field to ensure we can fetch/return it.
        // If _fields is missing, we define a robust default list.
        const requestParams = { 
            ...params,
            _fields: params._fields 
                ? params._fields + ',count' 
                : 'id,name,slug,description,image,parent,count,display,menu_order'
        };

        const response = await api.get("products/categories", requestParams);
        const pagination = extractPagination(response);
        
        console.log('🔍 [WooService] Got response from WooCommerce:', {
            categoryCount: response.data?.length || 0,
            firstCategory: response.data?.[0],
            hasCount: response.data?.[0] ? ('count' in response.data[0]) : false
        });
        
        // If count field is missing, fetch it for each category

        
        const categoriesWithCount = await Promise.all(
            response.data.map(async (category) => {
                // If count already exists and is a valid number, use it
                // We strictly check for type 'number' because sometimes it comes as undefined/null
                if (typeof category.count === 'number') {
                    return { ...category, product_count: category.count };
                }
                

                
                try {
                    // Fetch products for this category to get the count
                    const productsResponse = await api.get("products", {
                        category: category.id,
                        per_page: 1,
                        page: 1
                    });
                    
                    const count = parseInt(productsResponse.headers['x-wp-total'] || 0, 10);

                    
                    return {
                        ...category,
                        count: count
                    };
                } catch (error) {
                    console.error(`❌ Error fetching count for category ${category.id}:`, error.message);
                    return {
                        ...category,
                        count: 0
                    };
                }
            })
        );
        

        
        return {
            data: categoriesWithCount,
            total: pagination.total,
            totalPages: pagination.totalPages
        };
    },

    getCategory: async (userId, id) => {
        const api = await getApi(userId);
        const response = await api.get(`products/categories/${id}`);
        return response.data;
    },

    createCategory: async (userId, data) => {
        const api = await getApi(userId);
        const response = await api.post("products/categories", data);
        return response.data;
    },

    updateCategory: async (userId, id, data) => {
        const api = await getApi(userId);
        const response = await api.put(`products/categories/${id}`, data);
        return response.data;
    },

    deleteCategory: async (userId, id) => {
        const api = await getApi(userId);
        const response = await api.delete(`products/categories/${id}`, { force: true });
        return response.data;
    },

    // ============================================
    // COUPON MANAGEMENT
    // ============================================

    getCoupons: async (userId, params = {}) => {
        const api = await getApi(userId);
        const response = await api.get("coupons", params);
        const pagination = extractPagination(response);
        return {
            data: response.data,
            total: pagination.total,
            totalPages: pagination.totalPages
        };
    },

    getCoupon: async (userId, id) => {
        const api = await getApi(userId);
        const response = await api.get(`coupons/${id}`);
        return response.data;
    },

    createCoupon: async (userId, data) => {
        const prepareData = prepareCouponData(data);
        const api = await getApi(userId);
        const response = await api.post("coupons", prepareData);
        return response.data;
    },

    updateCoupon: async (userId, id, data) => {
        const prepareData = prepareCouponData(data);
        const api = await getApi(userId);
        const response = await api.put(`coupons/${id}`, prepareData);
        return response.data;
    },

    deleteCoupon: async (userId, id) => {
        const api = await getApi(userId);
        const response = await api.delete(`coupons/${id}`, { force: true });
        return response.data;
    },

    // ============================================
    // ATTRIBUTE MANAGEMENT
    // ============================================

    getAttributes: async (userId, params = {}) => {
        const api = await getApi(userId);
        const response = await api.get("products/attributes", params);
        const pagination = extractPagination(response);
        return {
            data: response.data,
            total: pagination.total,
            totalPages: pagination.totalPages
        };
    },

    getAttributeTerms: async (userId, attributeId, params = {}) => {
        const api = await getApi(userId);
        const response = await api.get(`products/attributes/${attributeId}/terms`, params);
        return response.data;
    },

    clearCache: (userId) => {
        if (userId) {
            apiCache.delete(userId);
            settingsCache.delete(userId);
        } else {
            apiCache.clear();
            settingsCache.clear();
        }
    },

    warmCache: async () => {
        console.log('🔥 [CACHE] Warming up started...');
        try {
             // 10 second delay to allow DB to fully stabilize and other services to boot
             setTimeout(async () => {
                 const allSettings = await Settings.find({});
                 console.log(`🔥 [CACHE] Found ${allSettings.stores || allSettings.length} stores to warm up`);
                 
                 for (const setting of allSettings) {
                     if (!setting.user) continue;
                     try {
                         // Fetch page 1 of products
                         console.log(`🔥 [CACHE] Warming for user ${setting.user}`);
                         await wooService.getProducts(setting.user, { per_page: 24, page: 1 });
                     } catch (err) {
                         console.error(`❌ [CACHE] Failed to warm for user ${setting.user}:`, err.message);
                     }
                 }
                 console.log('✅ [CACHE] Warm up complete');
             }, 10000);
        } catch (e) {
             console.error('Cache warm up failed', e);
        }
    }
};

module.exports = wooService;
