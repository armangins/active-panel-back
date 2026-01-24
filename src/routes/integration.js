const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');

// GET /api/integrations
router.get('/', integrationController.listIntegrations);

// POST /api/integrations
router.post('/', integrationController.addIntegration);

// DELETE /api/integrations/:id
router.delete('/:id', integrationController.removeIntegration);

module.exports = router;
