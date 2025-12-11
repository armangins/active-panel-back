const { z } = require('zod');

const categorySchema = z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    description: z.string().optional(),
    parent: z.number().int().optional(),
    image: z.union([z.object({ id: z.number() }), z.number(), z.null()]).optional()
});

module.exports = { categorySchema };
