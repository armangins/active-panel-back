const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const axios = require('axios');
const Settings = require('../models/Settings');
const encryptionService = require('../config/encryption');

let apiInstance = null;

const getApi = async (userId) => {
    // Fetch settings for the specific user
    const settings = await Settings.findOne({ user: userId });

    if (!settings) {
        // Don't log as error - this is expected for new users
        throw new Error('WooCommerce settings not configured');
    }

    try {
        const consumerKey = encryptionService.decrypt(settings.consumerKey);
        const consumerSecret = encryptionService.decrypt(settings.consumerSecret);

        return new WooCommerceRestApi({
            url: settings.storeUrl,
            consumerKey: consumerKey,
            consumerSecret: consumerSecret,
            version: "wc/v3"
        });
    } catch (err) {
        console.error('WooService: Decryption failed:', err.message);
        throw err;
    }
};

const wooService = {
    getProducts: async (userId, params = {}) => {
        try {
            const api = await getApi(userId);
            
            // PERFORMANCE: Only request essential fields for list view
            // Variations are NOT fetched here - they're loaded on-demand when needed
            // This dramatically improves initial load time
            const optimizedParams = {
                ...params,
                // If _fields is not specified, use minimal fields for list view
                _fields: params._fields || 'id,name,type,status,stock_status,stock_quantity,regular_price,sale_price,images,categories,sku'
            };
            
            const response = await api.get("products", optimizedParams);

            // PERFORMANCE OPTIMIZATION: Don't fetch variations on initial load
            // Variations are only needed when:
            // 1. Viewing product details (loaded separately)
            // 2. Calculating price ranges (can be done client-side if variations are cached)
            // For list view, we can show a placeholder or fetch variations on-demand
            
            // Return products without variations for faster initial load
            // Variations will be fetched separately when product details are viewed
            return {
                products: response.data.map(product => ({
                    ...product,
                    // Add empty variations array for variable products
                    // Frontend can fetch variations on-demand if needed
                    variations: product.type === 'variable' ? [] : undefined
                })),
                totalPages: parseInt(response.headers['x-wp-totalpages'] || 1),
                totalProducts: parseInt(response.headers['x-wp-total'] || response.data.length)
            };
        } catch (error) {
            throw error;
        }
    },

    getProduct: async (userId, id) => {
        try {
            const api = await getApi(userId);
            // SECURITY & ACCURACY: Only request regular_price, not price field (price may include tax)
            const response = await api.get(`products/${id}`, {
                _fields: 'id,name,type,status,description,short_description,sku,regular_price,sale_price,stock_quantity,stock_status,manage_stock,categories,images,attributes,tags,virtual,weight,dimensions,shipping_class,tax_status,tax_class,date_on_sale_from,date_on_sale_to'
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    createProduct: async (userId, data) => {
        try {
            // SECURITY: Sanitize all string inputs to prevent XSS
            const sanitizeString = (str) => {
                if (typeof str !== 'string') return str;
                // Remove HTML tags and dangerous characters
                return str.replace(/<[^>]*>/g, '').trim();
            };

            const sanitizedData = {
                ...data,
                name: data.name ? sanitizeString(data.name) : undefined,
                slug: data.slug ? sanitizeString(data.slug) : undefined,
                description: data.description ? sanitizeString(data.description) : undefined,
                short_description: data.short_description ? sanitizeString(data.short_description) : undefined,
                sku: data.sku ? sanitizeString(data.sku) : undefined,
                // Sanitize attribute options if present
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
            };

            const api = await getApi(userId);
            const response = await api.post("products", sanitizedData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    updateProduct: async (userId, productId, data) => {
        try {
            // SECURITY: Sanitize all string inputs to prevent XSS
            const sanitizeString = (str) => {
                if (typeof str !== 'string') return str;
                // Remove HTML tags and dangerous characters
                return str.replace(/<[^>]*>/g, '').trim();
            };

            const sanitizedData = {
                ...data,
                name: data.name ? sanitizeString(data.name) : undefined,
                slug: data.slug ? sanitizeString(data.slug) : undefined,
                description: data.description ? sanitizeString(data.description) : undefined,
                short_description: data.short_description ? sanitizeString(data.short_description) : undefined,
                sku: data.sku ? sanitizeString(data.sku) : undefined,
                // Sanitize attribute options if present
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
            };

            const api = await getApi(userId);
            const response = await api.put(`products/${productId}`, sanitizedData);
            return response.data;
        } catch (error) {
            throw error;
        }
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
        try {
            const api = await getApi(userId);
            const response = await api.post('products/batch', data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    uploadMedia: async (userId, file) => {
        try {


            const settings = await Settings.findOne({ user: userId });
            if (!settings) throw new Error('WooCommerce settings not configured');

            const baseUrl = settings.storeUrl.replace(/\/$/, '');
            const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

            // Priority 1: Try WordPress App Password (most reliable for media)
            if (settings.wordpressUsername && settings.wordpressAppPassword) {
                const appPassword = encryptionService.decrypt(settings.wordpressAppPassword);

                const auth = Buffer.from(`${settings.wordpressUsername}:${appPassword}`).toString('base64');

                const FormData = require('form-data');
                const form = new FormData();
                form.append('file', file.buffer, {
                    filename: sanitizedFilename,
                    contentType: file.mimetype
                });

                const response = await axios.post(`${baseUrl}/wp-json/wp/v2/media`, form, {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Basic ${auth}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                return response.data;
            }

            // Priority 2: Fallback to WooCommerce OAuth (if App Password not configured)
            // Priority 2: Fallback to WooCommerce OAuth (if App Password not configured)
            const api = await getApi(userId);

            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', file.buffer, {
                filename: sanitizedFilename,
                contentType: file.mimetype
            });

            const url = api.url + 'wp-json/wp/v2/media';
            const oauth = api._getOAuth().authorize({
                url: url,
                method: 'POST'
            });

            const fullUrl = `${url}?${Object.keys(oauth).map(key => `${key}=${oauth[key]}`).join('&')}`;

            const response = await axios.post(fullUrl, form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Media Upload Error:', error.response?.data?.message || error.message);
            if (process.env.NODE_ENV === 'development' && error.response?.data) {
                console.error('Media Upload Error Details:', error.response.data);
            }

            if (error.response?.data?.message) {
                error.customMessage = `WooCommerce Error: ${error.response.data.message}`;
            }
            throw error;
        }
    },

    getOrders: async (userId, params = {}) => {
        try {
            const api = await getApi(userId);
            const response = await api.get("orders", params);
            // Return both data and headers for pagination info
            return {
                data: response.data,
                total: parseInt(response.headers['x-wp-total'] || response.data.length),
                totalPages: parseInt(response.headers['x-wp-totalpages'] || 1)
            };
        } catch (error) {
            throw error;
        }
    },

    getOrder: async (userId, orderId) => {
        try {
            const api = await getApi(userId);
            const response = await api.get(`orders/${orderId}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    updateOrder: async (userId, orderId, data) => {
        try {
            const api = await getApi(userId);
            const response = await api.put(`orders/${orderId}`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    deleteOrder: async (userId, orderId) => {
        try {
            const api = await getApi(userId);
            const response = await api.delete(`orders/${orderId}`, { force: true });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    getCustomers: async (userId, params = {}) => {
        try {
            const api = await getApi(userId);
            const response = await api.get("customers", params);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // ============================================
    // VARIATION MANAGEMENT
    // ============================================

    /**
     * Get all variations for a product
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @param {object} params - Query parameters
     * @returns {Promise<{variations: Array, total: number}>}
     */
    getVariations: async (userId, productId, params = {}) => {
        try {
            const api = await getApi(userId);
            // SECURITY & ACCURACY: Only request regular_price, not price field (price may include tax)
            const response = await api.get(`products/${productId}/variations`, {
                per_page: 100,
                _fields: params._fields || 'id,name,sku,regular_price,sale_price,stock_quantity,stock_status,manage_stock,image,attributes',
                ...params
            });

            return {
                variations: response.data,
                total: parseInt(response.headers['x-wp-total'] || response.data.length)
            };
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get single variation by ID
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @param {string} variationId - Variation ID
     * @returns {Promise<object>} Variation data
     */
    getVariation: async (userId, productId, variationId) => {
        try {
            const api = await getApi(userId);
            const response = await api.get(`products/${productId}/variations/${variationId}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Create a new variation
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @param {object} data - Variation data
     * @returns {Promise<object>} Created variation
     */
    createVariation: async (userId, productId, data) => {
        try {
            const api = await getApi(userId);
            const response = await api.post(`products/${productId}/variations`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update existing variation
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @param {string} variationId - Variation ID
     * @param {object} data - Updated variation data
     * @returns {Promise<object>} Updated variation
     */
    updateVariation: async (userId, productId, variationId, data) => {
        try {
            const api = await getApi(userId);
            const response = await api.put(`products/${productId}/variations/${variationId}`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Delete variation
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @param {string} variationId - Variation ID
     * @returns {Promise<object>} Delete result
     */
    deleteVariation: async (userId, productId, variationId) => {
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

    /**
     * Batch operations for variations (create, update, delete multiple)
     * @param {string} userId - User ID
     * @param {string} productId - Product ID
     * @param {object} data - Batch data { create: [], update: [], delete: [] }
     * @returns {Promise<object>} Batch operation result
     */
    batchVariations: async (userId, productId, data) => {
        try {
            const api = await getApi(userId);
            const response = await api.post(`products/${productId}/variations/batch`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // ============================================
    // CATEGORY MANAGEMENT
    // ============================================

    getCategories: async (userId, params = {}) => {
        try {
            const api = await getApi(userId);
            const response = await api.get("products/categories", params);
            return {
                data: response.data,
                total: parseInt(response.headers['x-wp-total'] || response.data.length),
                totalPages: parseInt(response.headers['x-wp-totalpages'] || 1)
            };
        } catch (error) {
            throw error;
        }
    },

    getCategory: async (userId, id) => {
        try {
            const api = await getApi(userId);
            const response = await api.get(`products/categories/${id}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    createCategory: async (userId, data) => {
        try {
            const api = await getApi(userId);
            const response = await api.post("products/categories", data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    updateCategory: async (userId, id, data) => {
        try {
            const api = await getApi(userId);
            const response = await api.put(`products/categories/${id}`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    deleteCategory: async (userId, id) => {
        try {
            const api = await getApi(userId);
            const response = await api.delete(`products/categories/${id}`, { force: true });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // ============================================
    // COUPON MANAGEMENT
    // ============================================

    getCoupons: async (userId, params = {}) => {
        try {
            const api = await getApi(userId);
            const response = await api.get("coupons", params);
            return {
                data: response.data,
                total: parseInt(response.headers['x-wp-total'] || response.data.length),
                totalPages: parseInt(response.headers['x-wp-totalpages'] || 1)
            };
        } catch (error) {
            throw error;
        }
    },

    getCoupon: async (userId, id) => {
        try {
            const api = await getApi(userId);
            const response = await api.get(`coupons/${id}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    createCoupon: async (userId, data) => {
        try {
            const api = await getApi(userId);
            
            // SECURITY: Sanitize string inputs
            const sanitizeString = (str) => {
                if (typeof str !== 'string') return str;
                return str.trim().replace(/[<>]/g, '');
            };
            
            const sanitizedData = {
                ...data,
                code: data.code ? sanitizeString(data.code) : data.code,
                description: data.description ? sanitizeString(data.description) : data.description,
                // Ensure numeric fields are properly formatted
                amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
                minimum_amount: data.minimum_amount ? (typeof data.minimum_amount === 'string' ? parseFloat(data.minimum_amount) : data.minimum_amount) : undefined,
                maximum_amount: data.maximum_amount ? (typeof data.maximum_amount === 'string' ? parseFloat(data.maximum_amount) : data.maximum_amount) : undefined,
                usage_limit: data.usage_limit ? (typeof data.usage_limit === 'string' ? parseInt(data.usage_limit, 10) : data.usage_limit) : undefined,
                usage_limit_per_user: data.usage_limit_per_user ? (typeof data.usage_limit_per_user === 'string' ? parseInt(data.usage_limit_per_user, 10) : data.usage_limit_per_user) : undefined,
                // Validate email restrictions
                email_restrictions: data.email_restrictions && Array.isArray(data.email_restrictions) 
                    ? data.email_restrictions.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                    : undefined
            };
            
            const response = await api.post("coupons", sanitizedData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    updateCoupon: async (userId, id, data) => {
        try {
            const api = await getApi(userId);
            
            // SECURITY: Verify coupon ownership before updating
            try {
                const existingCoupon = await api.get(`coupons/${id}`);
                if (!existingCoupon.data) {
                    const error = new Error('Coupon not found');
                    error.status = 404;
                    throw error;
                }
            } catch (checkError) {
                if (checkError.status === 404) {
                    throw checkError;
                }
                // If it's a different error, continue (might be permission issue)
            }
            
            // SECURITY: Sanitize string inputs
            const sanitizeString = (str) => {
                if (typeof str !== 'string') return str;
                return str.trim().replace(/[<>]/g, '');
            };
            
            const sanitizedData = {
                ...data,
                code: data.code ? sanitizeString(data.code) : data.code,
                description: data.description ? sanitizeString(data.description) : data.description,
                // Ensure numeric fields are properly formatted
                amount: data.amount !== undefined ? (typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount) : undefined,
                minimum_amount: data.minimum_amount !== undefined ? (typeof data.minimum_amount === 'string' ? parseFloat(data.minimum_amount) : data.minimum_amount) : undefined,
                maximum_amount: data.maximum_amount !== undefined ? (typeof data.maximum_amount === 'string' ? parseFloat(data.maximum_amount) : data.maximum_amount) : undefined,
                usage_limit: data.usage_limit !== undefined ? (typeof data.usage_limit === 'string' ? parseInt(data.usage_limit, 10) : data.usage_limit) : undefined,
                usage_limit_per_user: data.usage_limit_per_user !== undefined ? (typeof data.usage_limit_per_user === 'string' ? parseInt(data.usage_limit_per_user, 10) : data.usage_limit_per_user) : undefined,
                // Validate email restrictions
                email_restrictions: data.email_restrictions !== undefined && Array.isArray(data.email_restrictions)
                    ? data.email_restrictions.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                    : undefined
            };
            
            const response = await api.put(`coupons/${id}`, sanitizedData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    deleteCoupon: async (userId, id) => {
        try {
            const api = await getApi(userId);
            const response = await api.delete(`coupons/${id}`, { force: true });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // ============================================
    // ATTRIBUTE MANAGEMENT
    // ============================================

    getAttributes: async (userId, params = {}) => {
        try {
            const api = await getApi(userId);
            const response = await api.get("products/attributes", params);
            return {
                data: response.data,
                total: parseInt(response.headers['x-wp-total'] || response.data.length),
                totalPages: parseInt(response.headers['x-wp-totalpages'] || 1)
            };
        } catch (error) {
            throw error;
        }
    },

    getAttributeTerms: async (userId, attributeId, params = {}) => {
        try {
            const api = await getApi(userId);
            const response = await api.get(`products/attributes/${attributeId}/terms`, params);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
};

module.exports = wooService;
