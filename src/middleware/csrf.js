/**
 * CSRF Protection Middleware
 * 
 * Validates CSRF tokens for state-changing operations (POST, PUT, DELETE, PATCH)
 * CSRF tokens are sent in X-CSRF-Token header and validated against cookie
 */

const crypto = require('crypto');

// Store for CSRF tokens (in production, use Redis or similar)
// For now, we'll validate against cookie only
const csrfTokens = new Map();
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

/**
 * Generate CSRF token
 * @returns {string} CSRF token
 */
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validate CSRF token
 * @param {string} tokenFromHeader - Token from X-CSRF-Token header
 * @param {string} tokenFromCookie - Token from csrf-token cookie
 * @returns {boolean} True if valid
 */
const validateCSRFToken = (tokenFromHeader, tokenFromCookie) => {
  if (!tokenFromHeader || !tokenFromCookie) {
    return false;
  }

  // Tokens must be same length for timing-safe comparison
  if (tokenFromHeader.length !== tokenFromCookie.length) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(tokenFromHeader),
      Buffer.from(tokenFromCookie)
    );
  } catch (error) {
    // If comparison fails, tokens don't match
    return false;
  }
};

/**
 * CSRF Protection Middleware
 * Only applies to state-changing operations (POST, PUT, DELETE, PATCH)
 */
module.exports = {
  /**
   * Generate and set CSRF token in cookie and response header
   * Call this on GET requests to provide CSRF token to frontend
   */
  generateToken: (req, res, next) => {
    // Generate new CSRF token
    const csrfToken = generateCSRFToken();
    
    // Set cookie with security flags
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = isProduction ? '; Secure' : '';
    
    res.cookie('csrf-token', csrfToken, {
      httpOnly: false, // Must be readable by JS for X-CSRF-Token header
      secure: isProduction,
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_EXPIRY,
      path: '/'
    });

    // Also send in response header for easy access
    res.setHeader('x-csrf-token', csrfToken);

    // Store token with expiry
    csrfTokens.set(csrfToken, {
      expiresAt: Date.now() + CSRF_TOKEN_EXPIRY
    });

    next();
  },

  /**
   * Validate CSRF token for state-changing operations
   */
  validate: (req, res, next) => {
    // Only validate state-changing methods
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const method = req.method.toUpperCase();

    if (!stateChangingMethods.includes(method)) {
      // GET, HEAD, OPTIONS don't need CSRF protection
      return next();
    }

    // Skip CSRF validation for certain endpoints
    const skipCSRFPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/google',
      '/api/auth/google/callback'
    ];

    if (skipCSRFPaths.some(path => req.path.startsWith(path))) {
      // Auth endpoints may not need CSRF (they have their own protection)
      // But we can still validate if token is provided
      return next();
    }

    // Get token from header
    const tokenFromHeader = req.headers['x-csrf-token'];
    
    // Get token from cookie
    const tokenFromCookie = req.cookies['csrf-token'];

    // Validate token
    if (!tokenFromHeader || !tokenFromCookie) {
      return res.status(403).json({
        success: false,
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING'
      });
    }

    try {
      if (!validateCSRFToken(tokenFromHeader, tokenFromCookie)) {
        return res.status(403).json({
          success: false,
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID'
        });
      }

      // Check if token has expired
      const tokenData = csrfTokens.get(tokenFromHeader);
      if (tokenData && tokenData.expiresAt < Date.now()) {
        csrfTokens.delete(tokenFromHeader);
        return res.status(403).json({
          success: false,
          error: 'CSRF token expired',
          code: 'CSRF_TOKEN_EXPIRED'
        });
      }

      // Token is valid
      next();
    } catch (error) {
      // Timing-safe comparison failed
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID'
      });
    }
  },

  /**
   * Cleanup expired CSRF tokens (call periodically)
   */
  cleanup: () => {
    const now = Date.now();
    for (const [token, data] of csrfTokens.entries()) {
      if (data.expiresAt < now) {
        csrfTokens.delete(token);
      }
    }
  }
};


