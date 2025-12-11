const { z } = require('zod');

// Helper to preprocess empty strings to null for optional string fields
const emptyStringToNull = z.preprocess((val) => {
    if (val === '' || val === undefined) return null;
    if (typeof val === 'string') return val.trim() || null;
    return val;
}, z.string().nullable().optional());

// Helper to preprocess empty strings to null for numeric string fields
const emptyStringToNullNumeric = z.preprocess((val) => {
    if (val === '' || val === undefined) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
}, z.union([z.string(), z.number(), z.null()]).optional());

// Helper to preprocess empty arrays to undefined
const emptyArrayToUndefined = z.preprocess((val) => {
    if (!val || (Array.isArray(val) && val.length === 0)) return undefined;
    return val;
}, z.array(z.number().int().positive()).optional());

const emptyEmailArrayToUndefined = z.preprocess((val) => {
    if (!val || (Array.isArray(val) && val.length === 0)) return undefined;
    return val;
}, z.array(z.string().email()).optional());

const couponSchema = z.object({
    code: z.string().min(1).max(100),
    amount: z.union([z.string().min(1), z.number()]),
    discount_type: z.enum(['percent', 'fixed_cart', 'fixed_product']).default('fixed_cart'),
    description: emptyStringToNull,
    date_expires: emptyStringToNull,
    usage_limit: emptyStringToNullNumeric,
    usage_limit_per_user: emptyStringToNullNumeric,
    minimum_amount: emptyStringToNull,
    maximum_amount: emptyStringToNull,
    free_shipping: z.boolean().optional(),
    individual_use: z.boolean().optional(),
    exclude_sale_items: z.boolean().optional(),
    product_ids: emptyArrayToUndefined,
    exclude_product_ids: emptyArrayToUndefined,
    product_categories: emptyArrayToUndefined,
    exclude_product_categories: emptyArrayToUndefined,
    email_restrictions: emptyEmailArrayToUndefined
});

module.exports = { couponSchema };
