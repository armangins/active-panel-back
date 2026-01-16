const wooService = require('../services/wooService');
const axios = require('axios');
const storageService = require('../services/storageService');

const mediaController = {
    uploadMedia: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Upload to Firebase Storage (Fast)
            const publicUrl = await storageService.uploadFile(
                req.file.buffer, 
                req.file.originalname, 
                req.file.mimetype
            );

            // Return mock WooCommerce response structure
            // Frontend expects: { id, source_url, ... }
            res.status(201).json({
                id: 0, // Placeholder ID indicate it's not yet in WP
                source_url: publicUrl,
                guid: { rendered: publicUrl },
                media_details: { sizes: {} } // Prevent frontend crash if it checks sizes
            });
            
        } catch (error) {
            console.error('Upload Error:', error);
            const status = error.response?.status || 500;
            res.status(status).json({
                success: false,
                message: error.message,
                details: error.response?.data
            });
        }
    },

    sideloadMedia: async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }

            // 1. Fetch the image
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            
            // 2. Validate it's an image
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                return res.status(400).json({ error: 'URL must point to an image' });
            }

            // 3. Construct filename
            const urlPath = new URL(url).pathname;
            const filename = urlPath.substring(urlPath.lastIndexOf('/') + 1) || 'sideloaded-image.jpg';

            // 4. Upload to Firebase Storage (Fast)
            const publicUrl = await storageService.uploadFile(
                Buffer.from(response.data),
                filename,
                contentType
            );

             // Return mock WooCommerce response structure
            res.status(201).json({
                id: 0, 
                source_url: publicUrl,
                guid: { rendered: publicUrl },
                 media_details: { sizes: {} }
            });

        } catch (error) {
            console.error('Sideload Error:', error.message);
            const status = error.response?.status || 500;
            res.status(status).json({
                success: false,
                message: 'Failed to fetch or upload image from URL',
                details: error.message
            });
        }
    },

    proxyMedia: async (req, res) => {
        try {
            const { url } = req.query;
            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }

            // Security check: Only allow specific domains if needed, or allow all for now
            // For now, we trust the frontend to only ask for safe image URLs
            
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer', // Use arraybuffer to handle compression automatically
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://google.com'
                }
            });

            // Set CORS headers explicitly for the image response
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Content-Type', response.headers['content-type']);
            res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
            
            res.send(response.data);
        } catch (error) {
            console.error('Proxy Error:', error.message);
            res.status(500).json({ error: 'Failed to proxy image' });
        }
    }
};

module.exports = mediaController;
