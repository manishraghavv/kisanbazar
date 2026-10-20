import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { EnterpriseService, AuditLogService, AnalyticsService } from './enterprise.service';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INDUSTRY
// ═══════════════════════════════════════════════════════════════════════════════

export const createIndustry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const industry = await EnterpriseService.createIndustry(req.body);
    res.status(201).json({ success: true, message: 'Industry created', data: industry });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateIndustry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const industry = await EnterpriseService.updateIndustry(req.params.id as string, req.body);
    res.json({ success: true, message: 'Industry updated', data: industry });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listIndustries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await EnterpriseService.listIndustries({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    });
    res.json({
      success: true,
      data: result.industries,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getIndustry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const industry = await EnterpriseService.getIndustry(req.params.id as string);
    res.json({ success: true, data: industry });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ENTERPRISE TIER
// ═══════════════════════════════════════════════════════════════════════════════

export const createTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tier = await EnterpriseService.createTier(req.body);
    res.status(201).json({ success: true, message: 'Enterprise tier created', data: tier });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tier = await EnterpriseService.updateTier(req.params.id as string, req.body);
    res.json({ success: true, message: 'Enterprise tier updated', data: tier });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listTiers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tiers = await EnterpriseService.listTiers();
    res.json({ success: true, data: tiers });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getTier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tier = await EnterpriseService.getTier(req.params.id as string);
    res.json({ success: true, data: tier });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  VENDOR ENTERPRISE ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const assignVendorEnterprise = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await EnterpriseService.assignVendor(req.user.id, req.body);
    res.json({ success: true, message: 'Vendor enterprise classification updated', data: updated });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getVendorEnterprise = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendorData = await EnterpriseService.getVendorEnterprise(req.user.id);
    res.json({ success: true, data: vendorData });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════════════════

export const listAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AuditLogService.list({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      action: req.query.action as string | undefined,
      actorId: req.query.actorId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({
      success: true,
      data: result.logs,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

export const trackProductView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.trackProductView(req.params.productId as string, {
      userId: req.user?.id,
      ipAddress: req.ip,
      sessionId: req.headers['x-session-id'] as string | undefined,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const trackSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.trackSearch({
      userId: req.user?.id,
      keyword: req.body.keyword,
      resultCount: req.body.resultCount,
      sessionId: req.headers['x-session-id'] as string | undefined,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getVendorDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.getVendorDashboard(req.user.id, {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      period: req.query.period as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getAdminDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.getAdminDashboard({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getSalesReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendorUserId = req.user.role === 'VENDOR' ? req.user.id : null;
    const result = await AnalyticsService.getSalesReport(vendorUserId, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
    });
    res.json({
      success: true,
      data: result.orders,
      summary: result.summary,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getProductPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.getProductPerformance({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      vendorId: req.query.vendorId as string | undefined,
    });
    res.json({
      success: true,
      data: result.products,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getMarketIntelligence = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.getMarketIntelligence({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      trendingPage: Number(req.query.trendingPage) || 1,
      trendingLimit: Number(req.query.trendingLimit) || 10,
      topSellingPage: Number(req.query.topSellingPage) || 1,
      topSellingLimit: Number(req.query.topSellingLimit) || 10,
      searchesPage: Number(req.query.searchesPage) || 1,
      searchesLimit: Number(req.query.searchesLimit) || 10,
      categoriesPage: Number(req.query.categoriesPage) || 1,
      categoriesLimit: Number(req.query.categoriesLimit) || 10,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getKhataOverdueReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.getKhataOverdueReport({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      minOverdueDays: Number(req.query.minOverdueDays) || 1,
    });
    res.json({
      success: true,
      data: result.accounts,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const exportUserData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsService.exportUserData(req.user.id, req.body.types);
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};
