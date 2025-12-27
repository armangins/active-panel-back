const xss = require('xss');

/**
 * Middleware to sanitize user input globally
 * Prevents XSS attacks by cleaning HTML from request body, query, and params
 */
const sanitizeInput = (req, res, next) => {
    // Helper to sanitize an object recursively
    const sanitizeObject = (obj) => {
        if (!obj) return;

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === 'string') {
                    obj[key] = xss(obj[key]);
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            }
        }
    };

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
};

module.exports = { sanitizeInput };
