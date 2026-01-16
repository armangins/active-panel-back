const { z } = require('zod');

const priceSchema = z.union([z.string(), z.number()]).optional().transform(val => (val === null || val === undefined) ? undefined : String(val));

const productObject = z.object({
    name: z.string().min(1),
    type: z.enum(['simple', 'variable', 'grouped', 'external']).default('simple'),
    status: z.enum(['draft', 'publish', 'private', 'pending']).default('draft'),
    description: z.string().optional(),
    short_description: z.string().optional(),
    sku: z.string().optional(),
    regular_price: priceSchema,
    sale_price: priceSchema,
    date_on_sale_from: z.string().nullable().optional(),
    date_on_sale_to: z.string().nullable().optional(),
    manage_stock: z.boolean().default(true),
    stock_quantity: z.union([z.string(), z.number(), z.null()]).optional(),
    categories: z.array(z.union([z.object({ id: z.coerce.number() }), z.coerce.number()])).optional(),
    images: z.array(z.object({
        id: z.coerce.number().optional(),
        src: z.string().optional(),
        alt: z.string().optional()
    })).optional(),
    attributes: z.array(z.object({
        id: z.coerce.number(),
        name: z.string().optional(),
        options: z.array(z.string()).optional(),
        variation: z.boolean().optional(),
        visible: z.boolean().optional(),
    })).optional(),
});

const productSchema = productObject.superRefine((data, ctx) => {
    if (data.status !== 'draft' && data.type !== 'variable') {
        if (!data.regular_price) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Regular price is required',
                path: ['regular_price']
            });
        }
        if (data.manage_stock && (data.stock_quantity === undefined || data.stock_quantity === null || data.stock_quantity === '')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Stock quantity is required',
                path: ['stock_quantity']
            });
        }
    }
});

const updateProductSchema = productObject.partial();

const variationSchema = z.object({
    regular_price: priceSchema,
    sale_price: priceSchema,
    sku: z.string().optional(),
    manage_stock: z.boolean().optional(),
    stock_quantity: z.union([z.string(), z.number(), z.null()]).optional(),
    attributes: z.array(z.object({
        id: z.coerce.number(),
        name: z.string().optional(),
        option: z.string()
    })).optional()
});

const updateVariationSchema = variationSchema.partial();

module.exports = { productSchema, updateProductSchema, variationSchema, updateVariationSchema };
