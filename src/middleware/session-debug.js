/**
 * Session Debugging Middleware
 * 
 * Helps diagnose session cookie issues in production
 * Logs session information for debugging cross-origin cookie problems
 */

const sessionDebugMiddleware = (req, res, next) => {
    // Only log in production to avoid spam in development
    if (process.env.NODE_ENV === 'production') {
        const sessionInfo = {
            path: req.path,
            method: req.method,
            hasSession: !!req.session,
            sessionID: req.sessionID || 'none',
            isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
            hasCookie: !!req.headers.cookie,
            cookieHeader: req.headers.cookie ? 'present' : 'missing',
            origin: req.headers.origin || 'none',
            referer: req.headers.referer || 'none'
        };

        // Log session info for auth-related routes
        if (req.path.includes('/auth') || req.path.includes('/api')) {
            console.log('[Session Debug]', JSON.stringify(sessionInfo));
        }

        // Intercept response to log Set-Cookie header
        const originalSend = res.send;
        res.send = function (data) {
            const setCookieHeader = res.getHeader('Set-Cookie');
            if (setCookieHeader && req.path.includes('/auth')) {
                console.log('[Session Debug] Set-Cookie header:',
                    Array.isArray(setCookieHeader)
                        ? setCookieHeader.map(c => c.split(';')[0])
                        : setCookieHeader.split(';')[0]
                );
            }
            return originalSend.call(this, data);
        };
    }

    next();
};

module.exports = sessionDebugMiddleware;
