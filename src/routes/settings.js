const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const validate = require('../middleware/validate');
const { settingsSchema } = require('../schemas/settings');

router.post('/settings', validate(settingsSchema), settingsController.saveSettings);
router.post('/settings/test-connection', settingsController.testConnection);
router.post('/settings/disconnect', settingsController.disconnectWooCommerce);
router.get('/settings', settingsController.getSettings);

module.exports = router;
