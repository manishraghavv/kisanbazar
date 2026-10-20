import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  createIndustry,
  updateIndustry,
  listIndustries,
  getIndustry,
  createTier,
  updateTier,
  listTiers,
  getTier,
  assignVendorEnterprise,
  getVendorEnterprise,
  listAuditLogs,
  trackProductView,
  trackSearch,
  getVendorDashboard,
  getAdminDashboard,
  getSalesReport,
  getProductPerformance,
  getKhataOverdueReport,
  getMarketIntelligence,
  exportUserData,
} from './enterprise.controller';
import {
  createIndustrySchema,
  updateIndustrySchema,
  listIndustriesQuerySchema,
  createTierSchema,
  updateTierSchema,
  assignVendorTierSchema,
  listAuditLogsQuerySchema,
  vendorAnalyticsQuerySchema,
  adminDashboardQuerySchema,
  productPerformanceQuerySchema,
  khataOverdueQuerySchema,
  dataExportSchema,
} from './enterprise.validator';

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
//  INDUSTRY  (Admin: CRUD; Public: List, Get)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/industries',
  validateQuery(listIndustriesQuerySchema),
  asyncHandler((req, res) => listIndustries(req as AuthRequest, res)),
);
router.get(
  '/industries/:id',
  asyncHandler((req, res) => getIndustry(req as AuthRequest, res)),
);
router.post(
  '/industries',
  authenticate,
  authorize('ADMIN'),
  validateBody(createIndustrySchema),
  asyncHandler((req, res) => createIndustry(req as AuthRequest, res)),
);
router.put(
  '/industries/:id',
  authenticate,
  authorize('ADMIN'),
  validateBody(updateIndustrySchema),
  asyncHandler((req, res) => updateIndustry(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  ENTERPRISE TIER  (Admin: CRUD; Public: List, Get)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/enterprise-tiers',
  asyncHandler((req, res) => listTiers(req as AuthRequest, res)),
);
router.get(
  '/enterprise-tiers/:id',
  asyncHandler((req, res) => getTier(req as AuthRequest, res)),
);
router.post(
  '/enterprise-tiers',
  authenticate,
  authorize('ADMIN'),
  validateBody(createTierSchema),
  asyncHandler((req, res) => createTier(req as AuthRequest, res)),
);
router.put(
  '/enterprise-tiers/:id',
  authenticate,
  authorize('ADMIN'),
  validateBody(updateTierSchema),
  asyncHandler((req, res) => updateTier(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  VENDOR ENTERPRISE  (Vendor self-service)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/vendors/me/enterprise',
  authenticate,
  authorize('VENDOR'),
  asyncHandler((req, res) => getVendorEnterprise(req as AuthRequest, res)),
);
router.put(
  '/vendors/me/enterprise',
  authenticate,
  authorize('VENDOR'),
  validateBody(assignVendorTierSchema),
  asyncHandler((req, res) => assignVendorEnterprise(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIT LOGS  (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/audit-logs',
  authenticate,
  authorize('ADMIN'),
  validateQuery(listAuditLogsQuerySchema),
  asyncHandler((req, res) => listAuditLogs(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYTICS & TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

// Tracking (can be called from frontend, light auth)
router.post(
  '/track/product-view/:productId',
  authenticate,
  asyncHandler((req, res) => trackProductView(req as AuthRequest, res)),
);
router.post(
  '/track/search',
  authenticate,
  asyncHandler((req, res) => trackSearch(req as AuthRequest, res)),
);

// Vendor dashboard
router.get(
  '/vendors/me/dashboard',
  authenticate,
  authorize('VENDOR'),
  validateQuery(vendorAnalyticsQuerySchema),
  asyncHandler((req, res) => getVendorDashboard(req as AuthRequest, res)),
);

// Admin dashboard
router.get(
  '/admin/dashboard',
  authenticate,
  authorize('ADMIN'),
  validateQuery(adminDashboardQuerySchema),
  asyncHandler((req, res) => getAdminDashboard(req as AuthRequest, res)),
);

// Reports
router.get(
  '/reports/sales',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateQuery(vendorAnalyticsQuerySchema),
  asyncHandler((req, res) => getSalesReport(req as AuthRequest, res)),
);
router.get(
  '/reports/product-performance',
  authenticate,
  authorize('ADMIN'),
  validateQuery(productPerformanceQuerySchema),
  asyncHandler((req, res) => getProductPerformance(req as AuthRequest, res)),
);
router.get(
  '/reports/market-intelligence',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  asyncHandler((req, res) => getMarketIntelligence(req as AuthRequest, res)),
);

router.get(
  '/reports/khata-overdue',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  validateQuery(khataOverdueQuerySchema),
  asyncHandler((req, res) => getKhataOverdueReport(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA EXPORT  (GDPR/DPDP Act compliance)
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/users/me/export',
  authenticate,
  validateBody(dataExportSchema),
  asyncHandler((req, res) => exportUserData(req as AuthRequest, res)),
);

export default router;
