const fs = require('fs');
const path = require('path');

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        // Log error to file for debugging
        const logPath = path.join(__dirname, '../../validation_debug.log');
        const logContent = `[${new Date().toISOString()}] Validation Error: ${JSON.stringify(result.error.issues, null, 2)}\nRequest Body: ${JSON.stringify(req.body, null, 2)}\n\n`;
        try {
            fs.appendFileSync(logPath, logContent);
        } catch (err) {
            console.error('Failed to write to validation log', err);
        }

        return res.status(400).json({
            success: false,
            message: result.error.issues[0].message,
            errors: result.error.issues,
        });
    }
    
    // SECURITY: Attach validated and sanitized data to request
    // This ensures controllers use validated data, not raw req.body
    req.validatedData = result.data;
    next();
};

module.exports = validate;
