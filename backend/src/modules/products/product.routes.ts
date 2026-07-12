import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  createCategory,
  updateCategory,
  getCategoryById,
  getCategories,
  deleteCategory,
  getCategoryTree,
  getCategoryProducts,
  createProduct,
  updateProduct,
  moderateProduct,
  getProductById,
  getProducts,
  deleteProduct,
  submitForModeration,
  createVariant,
  updateVariant,
  deleteVariant,
  getVariants,
  addImage,
  deleteImage,
  setPrimaryImage,
  getImages,
  addAttribute,
  updateAttribute,
  deleteAttribute,
  adjustInventory,
  getLowStock,
  getInventoryLogs,
} from './product.controller';
import {
  createCategorySchema,
  updateCategorySchema,
  getCategoriesQuerySchema,
  createProductSchema,
  updateProductSchema,
  moderateProductSchema,
  getProductsQuerySchema,
  createVariantSchema,
  updateVariantSchema,
  addImageSchema,
  addAttributeSchema,
  updateAttributeSchema,
  adjustInventorySchema,
} from './product.validator';

const router = Router();

function validateBody(schema: ReturnType<typeof import('joi').object>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      });
      return;
    }
    req.body = value;
    next();
  };
}

function validateQuery(schema: ReturnType<typeof import('joi').object>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      });
      return;
    }
    Object.assign(req.query, value);
    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CATEGORIES  (Public: GET; Admin: POST, PUT, DELETE)
// ═══════════════════════════════════════════════════════════════════════════════

// Public endpoints
router.get('/categories/tree', asyncHandler((req, res) => getCategoryTree(req as AuthRequest, res)));
router.get('/categories', validateQuery(getCategoriesQuerySchema), asyncHandler((req, res) => getCategories(req as AuthRequest, res)));
router.get('/categories/:id', asyncHandler((req, res) => getCategoryById(req as AuthRequest, res)));
router.get('/categories/:id/products', validateQuery(getProductsQuerySchema), asyncHandler((req, res) => getCategoryProducts(req as AuthRequest, res)));

// Admin-only
router.post('/categories', authenticate, authorize('ADMIN'), validateBody(createCategorySchema), asyncHandler((req, res) => createCategory(req as AuthRequest, res)));
router.put('/categories/:id', authenticate, authorize('ADMIN'), validateBody(updateCategorySchema), asyncHandler((req, res) => updateCategory(req as AuthRequest, res)));
router.delete('/categories/:id', authenticate, authorize('ADMIN'), asyncHandler((req, res) => deleteCategory(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

// Public endpoints
router.get('/products', validateQuery(getProductsQuerySchema), asyncHandler((req, res) => getProducts(req as AuthRequest, res)));
router.get('/products/:id', asyncHandler((req, res) => getProductById(req as AuthRequest, res)));

// Vendor endpoints (authenticated)
router.post('/products', authenticate, authorize('VENDOR'), validateBody(createProductSchema), asyncHandler((req, res) => createProduct(req as AuthRequest, res)));
router.put('/products/:id', authenticate, authorize('VENDOR', 'ADMIN'), validateBody(updateProductSchema), asyncHandler((req, res) => updateProduct(req as AuthRequest, res)));
router.delete('/products/:id', authenticate, authorize('VENDOR', 'ADMIN'), asyncHandler((req, res) => deleteProduct(req as AuthRequest, res)));
router.post('/products/:id/submit', authenticate, authorize('VENDOR'), asyncHandler((req, res) => submitForModeration(req as AuthRequest, res)));

// Admin-only moderation
router.put('/products/:id/moderate', authenticate, authorize('ADMIN'), validateBody(moderateProductSchema), asyncHandler((req, res) => moderateProduct(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  VARIANTS  (Vendor only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/products/:id/variants', asyncHandler((req, res) => getVariants(req as AuthRequest, res)));
router.post('/products/:id/variants', authenticate, authorize('VENDOR'), validateBody(createVariantSchema), asyncHandler((req, res) => createVariant(req as AuthRequest, res)));
router.put('/variants/:variantId', authenticate, authorize('VENDOR'), validateBody(updateVariantSchema), asyncHandler((req, res) => updateVariant(req as AuthRequest, res)));
router.delete('/variants/:variantId', authenticate, authorize('VENDOR'), asyncHandler((req, res) => deleteVariant(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  IMAGES  (Vendor only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/products/:id/images', asyncHandler((req, res) => getImages(req as AuthRequest, res)));
router.post('/products/:id/images', authenticate, authorize('VENDOR'), validateBody(addImageSchema), asyncHandler((req, res) => addImage(req as AuthRequest, res)));
router.put('/products/:id/images/:imageId/primary', authenticate, authorize('VENDOR'), asyncHandler((req, res) => setPrimaryImage(req as AuthRequest, res)));
router.delete('/products/:id/images/:imageId', authenticate, authorize('VENDOR'), asyncHandler((req, res) => deleteImage(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  ATTRIBUTES  (Vendor only)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/products/:id/attributes', authenticate, authorize('VENDOR'), validateBody(addAttributeSchema), asyncHandler((req, res) => addAttribute(req as AuthRequest, res)));
router.put('/products/:id/attributes/:attributeId', authenticate, authorize('VENDOR'), validateBody(updateAttributeSchema), asyncHandler((req, res) => updateAttribute(req as AuthRequest, res)));
router.delete('/products/:id/attributes/:attributeId', authenticate, authorize('VENDOR'), asyncHandler((req, res) => deleteAttribute(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  INVENTORY  (Vendor only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/inventory/low-stock', authenticate, authorize('VENDOR'), asyncHandler((req, res) => getLowStock(req as AuthRequest, res)));
router.get('/inventory/logs', authenticate, authorize('VENDOR'), asyncHandler((req, res) => getInventoryLogs(req as AuthRequest, res)));
router.post('/inventory/adjust', authenticate, authorize('VENDOR'), validateBody(adjustInventorySchema), asyncHandler((req, res) => adjustInventory(req as AuthRequest, res)));

export default router;
