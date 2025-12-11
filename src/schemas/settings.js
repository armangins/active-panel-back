const { z } = require('zod');

const settingsSchema = z.object({
    storeUrl: z.string().url(),
    consumerKey: z.string().min(1),
    consumerSecret: z.string().min(1),
    wordpressUsername: z.string().optional(),
    wordpressAppPassword: z.string().optional(),
    ga4PropertyId: z.string().optional(),
    ga4AccessToken: z.string().optional(),
    geminiApiKey: z.string().optional(),
    lowStockThreshold: z.union([z.string(), z.number()]).optional()
});

module.exports = { settingsSchema };
