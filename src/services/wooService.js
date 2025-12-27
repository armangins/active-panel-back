const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const axios = require('axios');
const FormData = require('form-data');
const Settings = require('../models/Settings');
const encryptionService = require('../config/encryption');

// In-memory cache for API instances and settings
const apiCache = new Map();
const settingsCache = new Map();

/**
 * Sanitize string to prevent XSS and remove HTML tags
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
const prepareProductData = (data) => ({
    ...data,
    name: data.name ? sanitizeString(data.name) : undefined,
    slug: data.slug ? sanitizeString(data.slug) : undefined,
    description: data.description ? sanitizeString(data.description) : undefined,
    short_description: data.short_description ? sanitizeString(data.short_description) : undefined,
    sku: data.sku ? sanitizeString(data.sku) : undefined,
    // Convert dates to ISO 8601 format with UTC timezone for WooCommerce API
    date_on_sale_from: data.date_on_sale_from ? `${data.date_on_sale_from}T00:00:00Z` : null,
    date_on_sale_to: data.date_on_sale_to ? `${data.date_on_sale_to}T23:59:59Z` : null,
    ...(data.attributes && Array.isArray(data.attributes) && {
        attributes: data.attributes.map(attr => ({
            ...attr,
            name: attr.name ? sanitizeString(attr.name) : attr.name,
            options: attr.options && Array.isArray(attr.options)
                ? attr.options.map(opt => sanitizeString(opt))
                : attr.options,
            option: attr.option ? sanitizeString(attr.option) : attr.option,
        }))
    }),
});

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
        const api = await getApi(userId);

        const optimizedParams = {
            ...params,
            _fields: params._fields || 'id,name,type,status,description,short_description,stock_status,stock_quantity,price,regular_price,sale_price,price_html,images,categories,sku'
        };

        const response = await api.get("products", optimizedParams);
        const pagination = extractPagination(response);

        return {
            products: response.data.map(product => ({
                ...product,
                variations: product.type === 'variable' ? [] : undefined
            })),
            totalPages: pagination.totalPages,
            totalProducts: pagination.total
        };
    },

    getProduct: async (userId, id) => {
        try {
            const api = await getApi(userId);
            // SECURITY & ACCURACY: Only request regular_price, not price field (price may include tax)
            const response = await api.get(`products/${id}`, {
                _fields: 'id,name,type,status,description,short_description,sku,price,regular_price,sale_price,price_html,stock_quantity,stock_status,manage_stock,categories,images,attributes,tags,virtual,weight,dimensions,shipping_class,tax_status,tax_class,date_on_sale_from,date_on_sale_to'
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    createProduct: async (userId, data) => {
        const prepareData = prepareProductData(data);
        console.log('🔍 [CREATE] Scheduled pricing data:', {
            date_on_sale_from: prepareData.date_on_sale_from,
            date_on_sale_to: prepareData.date_on_sale_to
        });
        const api = await getApi(userId);
        const response = await api.post("products", prepareData);
        console.log('✅ [CREATE] WooCommerce response:', {
            id: response.data.id,
            date_on_sale_from: response.data.date_on_sale_from,
            date_on_sale_to: response.data.date_on_sale_to
        });
        return response.data;
    },

    updateProduct: async (userId, productId, data) => {
        const prepareData = prepareProductData(data);
        console.log('🔍 [UPDATE] Scheduled pricing data:', {
            date_on_sale_from: prepareData.date_on_sale_from,
            date_on_sale_to: prepareData.date_on_sale_to
        });
        const api = await getApi(userId);
        const response = await api.put(`products/${productId}`, prepareData);
        console.log('✅ [UPDATE] WooCommerce response:', {
            id: response.data.id,
            date_on_sale_from: response.data.date_on_sale_from,
            date_on_sale_to: response.data.date_on_sale_to
        });
        return response.data;
    },

    deleteProduct: async (userId, productId) => {
        try {
            const api = await getApi(userId);
            // force: true is required to permanently delete instead of moving to trash
            const response = await api.delete(`products/${productId}`, { force: true });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    batchProducts: async (userId, data) => {
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
        return response.data;
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
        const api = await getApi(userId);
        const response = await api.post(`products/${productId}/variations`, data);
        return response.data;
    },

    updateVariation: async (userId, productId, variationId, data) => {
        const api = await getApi(userId);
        const response = await api.put(`products/${productId}/variations/${variationId}`, data);
        return response.data;
    },

    deleteVariation: async (userId, productId, variationId) => {
        const api = await getApi(userId);
        const response = await api.delete(`products/${productId}/variations/${variationId}`, {
            force: true
        });
        return response.data;
    },

    batchVariations: async (userId, productId, data) => {
        const api = await getApi(userId);
        const response = await api.post(`products/${productId}/variations/batch`, data);
        return response.data;
    },

    // ============================================
    // CATEGORY MANAGEMENT
    // ============================================

    getCategories: async (userId, params = {}) => {
        const api = await getApi(userId);
        const response = await api.get("products/categories", params);
        const pagination = extractPagination(response);
        return {
            data: response.data,
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
    }
};

module.exports = wooService;
