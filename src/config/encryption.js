const crypto = require('crypto');
require('dotenv').config();

const algorithm = 'aes-256-cbc';
const key = process.env.ENCRYPTION_KEY
    ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32)
    : crypto.randomBytes(32);

const encryptionService = {
    encrypt: (text) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        // Return combined IV and encrypted data
        return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    },

    decrypt: (text) => {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
};

module.exports = encryptionService;
