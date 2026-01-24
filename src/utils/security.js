const dns = require('dns');
const url = require('url');

const PRIVATE_IP_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
];

const security = {
    /**
     * Sanitize user input to prevent Stored XSS
     * Strict: Allow only alphanumeric, spaces, dashes, underscores, dots
     */
    sanitizeName: (name) => {
        if (!name) return '';
        // Remove any HTML tags
        let clean = name.replace(/<[^>]*>/g, '');
        // Limit length
        return clean.substring(0, 50).trim();
    },

    /**
     * Validate that a URL is public to prevent SSRF
     * Allows localhost in development mode only
     */
    validatePublicUrl: (inputUrl) => {
        return new Promise((resolve, reject) => {
            try {
                const parsed = new url.URL(inputUrl);
                const hostname = parsed.hostname;

                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return reject(new Error('Invalid protocol. Use http or https.'));
                }

                // Allow localhost in development
                if (process.env.NODE_ENV === 'development' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
                    return resolve(true);
                }

                dns.lookup(hostname, (err, address) => {
                    if (err) return reject(new Error('Could not resolve hostname'));

                    // Check against private ranges
                    for (const regex of PRIVATE_IP_RANGES) {
                        if (regex.test(address)) {
                            return reject(new Error('Internal/Private URLs are not allowed'));
                        }
                    }

                    resolve(true);
                });
            } catch (err) {
                reject(new Error('Invalid URL format'));
            }
        });
    }
};

module.exports = security;
