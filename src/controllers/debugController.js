const wooService = require('../services/wooService');
const Settings = require('../models/Settings');

module.exports = {
  getCategoriesWithCount: async (req, res) => {
    try {
      // Find the first user who has configured settings
      const settings = await Settings.findOne({});
      if (!settings) {
        return res.status(404).json({ error: 'No WooCommerce settings found in database' });
      }

      console.log('🔎 [Debug] Using user ID:', settings.user);

      // Use that user's ID to fetch categories
      const { data } = await wooService.getCategories(settings.user, {});
      
      data.forEach(cat => {
        console.log('🔎 [Debug] Category', { id: cat.id, name: cat.name, count: cat.count });
      });
      res.json(data);
    } catch (err) {
      console.error('❌ [Debug] Error fetching categories with count', err);
      res.status(500).json({ error: err.message });
    }
  },
};
