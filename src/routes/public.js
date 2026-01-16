const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');

// Public Media Proxy Route - No Auth Required
// This allows <img> tags to load images without Authorization headers
router.get('/media/proxy', mediaController.proxyMedia);

module.exports = router;
