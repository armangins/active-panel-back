const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const validate = require('../middleware/validate');
const { settingsSchema } = require('../schemas/settings');

router.post('/settings', validate(settingsSchema), settingsController.saveSettings);
router.get('/settings', settingsController.getSettings);

module.exports = router;
