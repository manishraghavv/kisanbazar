import Joi from 'joi';

// ── Categories ───────────────────────────────────────────────────────────────

export const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  nameHi: Joi.string().allow('').optional(),
  slug: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .optional(),
  parentId: Joi.string().uuid().optional().allow(null),
  iconUrl: Joi.string().uri().optional().allow(''),
  sortOrder: Joi.number().integer().min(0).default(0),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100),
  nameHi: Joi.string().allow(''),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/),
  parentId: Joi.string().uuid().allow(null),
  iconUrl: Joi.string().uri().allow(''),
  sortOrder: Joi.number().integer().min(0),
}).min(1);

export const getCategoriesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().optional(),
  parentId: Joi.string().uuid().allow('null').optional(),
});

// ── Products ─────────────────────────────────────────────────────────────────

export const createProductSchema = Joi.object({
  categoryId: Joi.string().uuid().required(),
  name: Joi.string().min(2).max(200).required(),
  nameHi: Joi.string().allow('').optional(),
  description: Joi.string().allow('').optional().max(2000),
  descriptionHi: Joi.string().allow('').optional().max(2000),
  hsnCode: Joi.string()
    .pattern(/^\d{4,8}$/)
    .optional()
    .messages({ 'string.pattern.base': 'HSN code must be 4-8 digits' }),
  gstRate: Joi.number().min(0).max(100).optional(),
  unitOfMeasure: Joi.string().max(50).optional(),
  applicableCrops: Joi.array().items(Joi.string()).optional(),
  seasonalFlag: Joi.boolean().default(false),
});

export const updateProductSchema = Joi.object({
  categoryId: Joi.string().uuid(),
  name: Joi.string().min(2).max(200),
  nameHi: Joi.string().allow(''),
  description: Joi.string().allow('').max(2000),
  descriptionHi: Joi.string().allow('').max(2000),
  hsnCode: Joi.string().pattern(/^\d{4,8}$/),
  gstRate: Joi.number().min(0).max(100),
  unitOfMeasure: Joi.string().max(50),
  applicableCrops: Joi.array().items(Joi.string()),
  seasonalFlag: Joi.boolean(),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'),
}).min(1);

export const moderateProductSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  moderationNote: Joi.string().allow('').max(500).optional(),
});

export const getProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().optional(),
  categoryId: Joi.string().uuid().optional(),
  vendorId: Joi.string().uuid().optional(),
  status: Joi.string()
    .valid('DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED')
    .optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  seasonalFlag: Joi.boolean().optional(),
  crop: Joi.string().optional(),
  sortBy: Joi.string().valid('createdAt', 'name', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  inStockOnly: Joi.boolean().optional(),
  minRating: Joi.number().min(1).max(5).optional(),
});

// ── Product Variants ─────────────────────────────────────────────────────────

export const createVariantSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  variantName: Joi.string().max(200).optional(),
  mrp: Joi.number().positive().required(),
  sellingPrice: Joi.number().positive().required(),
  stockQuantity: Joi.number().integer().min(0).default(0),
  reorderThreshold: Joi.number().integer().min(0).default(0),
  weightGrams: Joi.number().integer().positive().optional(),
  attributes: Joi.object().optional(),
});

export const updateVariantSchema = Joi.object({
  sku: Joi.string().max(100),
  variantName: Joi.string().max(200),
  mrp: Joi.number().positive(),
  sellingPrice: Joi.number().positive(),
  stockQuantity: Joi.number().integer().min(0),
  reorderThreshold: Joi.number().integer().min(0),
  weightGrams: Joi.number().integer().positive().allow(null),
  attributes: Joi.object(),
}).min(1);

// ── Product Images ───────────────────────────────────────────────────────────

export const addImageSchema = Joi.object({
  imageUrl: Joi.string().uri().required(),
  isPrimary: Joi.boolean().default(false),
  sortOrder: Joi.number().integer().min(0).default(0),
});

export const reorderImagesSchema = Joi.object({
  imageIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

// ── Product Attributes ───────────────────────────────────────────────────────

export const addAttributeSchema = Joi.object({
  name: Joi.string().max(100).required(),
  value: Joi.string().max(500).required(),
  nameHi: Joi.string().allow('').optional(),
});

export const updateAttributeSchema = Joi.object({
  name: Joi.string().max(100),
  value: Joi.string().max(500),
  nameHi: Joi.string().allow(''),
}).min(1);

// ── Inventory ────────────────────────────────────────────────────────────────

export const adjustInventorySchema = Joi.object({
  variantId: Joi.string().uuid().required(),
  quantityChange: Joi.number().integer().required().messages({
    'number.base': 'quantityChange is required. Use positive for restock, negative for sale/adjustment.',
  }),
  reason: Joi.string()
    .valid('SALE', 'RESTOCK', 'RETURN', 'ADJUSTMENT', 'DAMAGED')
    .required(),
  referenceId: Joi.string().uuid().optional(),
  performedById: Joi.string().uuid().optional(),
});
