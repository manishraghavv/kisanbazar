import { Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../common/errors';

export const EnterpriseService = {
  async createIndustry(data: { name: string; slug: string; description?: string; isActive?: boolean }) {
    const existing = await prisma.industry.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictError(`Industry with slug "${data.slug}" already exists`);
    return prisma.industry.create({ data });
  },

  async updateIndustry(id: string, data: { name?: string; slug?: string; description?: string; isActive?: boolean }) {
    const industry = await prisma.industry.findUnique({ where: { id } });
    if (!industry) throw new NotFoundError('Industry not found');
    if (data.slug && data.slug !== industry.slug) {
      const slugExists = await prisma.industry.findUnique({ where: { slug: data.slug } });
      if (slugExists) throw new ConflictError(`Slug "${data.slug}" already in use`);
    }
    return prisma.industry.update({ where: { id }, data });
  },

  async listIndustries(filters: { page: number; limit: number; isActive?: boolean }) {
    const { page, limit, isActive } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.IndustryWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    const [industries, total] = await Promise.all([
      prisma.industry.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.industry.count({ where }),
    ]);
    return { industries, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getIndustry(id: string) {
    const industry = await prisma.industry.findUnique({
      where: { id },
      include: { _count: { select: { vendors: true } } },
    });
    if (!industry) throw new NotFoundError('Industry not found');
    return industry;
  },

  async createTier(data: {
    name: string; size: string; minAnnualRevenue?: number; maxAnnualRevenue?: number;
    defaultCommissionRate?: number; maxKhataLimit?: number; description?: string;
  }) {
    const sizeExists = await prisma.enterpriseTier.findUnique({ where: { size: data.size as any } });
    if (sizeExists) throw new ConflictError(`Tier for size "${data.size}" already exists`);
    return prisma.enterpriseTier.create({
      data: {
        name: data.name, size: data.size as any,
        minAnnualRevenue: data.minAnnualRevenue ? new Prisma.Decimal(data.minAnnualRevenue) : undefined,
        maxAnnualRevenue: data.maxAnnualRevenue ? new Prisma.Decimal(data.maxAnnualRevenue) : undefined,
        defaultCommissionRate: data.defaultCommissionRate ? new Prisma.Decimal(data.defaultCommissionRate) : undefined,
        maxKhataLimit: data.maxKhataLimit ? new Prisma.Decimal(data.maxKhataLimit) : undefined,
        description: data.description,
      },
    });
  },

  async updateTier(id: string, data: any) {
    const tier = await prisma.enterpriseTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundError('Enterprise tier not found');
    const updateData: Prisma.EnterpriseTierUpdateInput = {};
    const decimalFields = ['minAnnualRevenue', 'maxAnnualRevenue', 'defaultCommissionRate', 'maxKhataLimit'];
    const directFields = ['name', 'size', 'description'];
    for (const field of directFields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    for (const field of decimalFields) {
      if (data[field] !== undefined) {
        (updateData as any)[field] = data[field] === null ? null : new Prisma.Decimal(data[field]);
      }
    }
    return prisma.enterpriseTier.update({ where: { id }, data: updateData });
  },

  async listTiers() {
    return prisma.enterpriseTier.findMany({ orderBy: { size: 'asc' } });
  },

  async getTier(id: string) {
    const tier = await prisma.enterpriseTier.findUnique({
      where: { id },
      include: { _count: { select: { vendors: true } } },
    });
    if (!tier) throw new NotFoundError('Enterprise tier not found');
    return tier;
  },

  async assignVendor(vendorUserId: string, data: { industryId?: string | null; enterpriseTierId?: string | null }) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new NotFoundError('Vendor profile not found');
    if (data.industryId) {
      const industry = await prisma.industry.findUnique({ where: { id: data.industryId } });
      if (!industry) throw new NotFoundError('Industry not found');
    }
    if (data.enterpriseTierId) {
      const tier = await prisma.enterpriseTier.findUnique({ where: { id: data.enterpriseTierId } });
      if (!tier) throw new NotFoundError('Enterprise tier not found');
    }
    return prisma.vendor.update({
      where: { id: vendor.id },
      data: { industryId: data.industryId ?? null, enterpriseTierId: data.enterpriseTierId ?? null },
      include: { industry: true, enterpriseTier: true },
    });
  },

  async getVendorEnterprise(vendorUserId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: vendorUserId },
      include: { industry: true, enterpriseTier: true },
    });
    if (!vendor) throw new NotFoundError('Vendor profile not found');
    return vendor;
  }
};

export const AuditLogService = {
  async create(data: {
    actorId?: string; actorRole?: string; action: string;
    entityType: string; entityId: string; oldData?: any; newData?: any; ipAddress?: string;
  }) {
    return prisma.auditLog.create({ data });
  },

  async list(filters: {
    page: number; limit: number; entityType?: string; entityId?: string;
    action?: string; actorId?: string; startDate?: string; endDate?: string;
  }) {
    const { page, limit, entityType, entityId, action, actorId, startDate, endDate } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
};

export const AnalyticsService = {
  async trackProductView(productId: string, data: { userId?: string; ipAddress?: string; sessionId?: string }) {
    return prisma.productView.create({
      data: { productId, userId: data.userId || null, ipAddress: data.ipAddress || null, sessionId: data.sessionId || null },
    });
  },

  async trackSearch(data: { userId?: string; keyword: string; resultCount?: number; sessionId?: string }) {
    return prisma.searchHistory.create({
      data: { userId: data.userId || null, keyword: data.keyword, resultCount: data.resultCount || null, sessionId: data.sessionId || null },
    });
  },

  async getVendorDashboard(vendorUserId: string, filters: { startDate?: string; endDate?: string; period?: string }) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new NotFoundError('Vendor profile not found');

    const { startDate, endDate } = filters;
    const dateFilterFields: Record<string, Date> = {};
    if (startDate) dateFilterFields.gte = new Date(startDate);
    if (endDate) dateFilterFields.lte = new Date(endDate);

    const dateFilter = Object.keys(dateFilterFields).length ? dateFilterFields : undefined;
    const orderWhere: Prisma.OrderWhereInput = {
      items: { some: { variant: { product: { vendorId: vendor.id } } } },
      ...(dateFilter ? { createdAt: dateFilter as any } : {}),
    };

    const orderAgg = await prisma.order.aggregate({
      where: { ...orderWhere, status: 'DELIVERED' },
      _sum: { totalAmount: true },
      _count: true,
    });

    const topProducts = await prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { order: orderWhere },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const topProductDetails = await Promise.all(
      topProducts.map(async (item) => {
        const variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: { select: { name: true, slug: true } } },
        });
        return {
          variantId: item.variantId, variantName: variant?.variantName || 'Unknown',
          productName: variant?.product.name || 'Unknown', productSlug: variant?.product.slug || '',
          totalSold: item._sum.quantity || 0,
        };
      }),
    );

    const khataAccounts = await prisma.khataAccount.findMany({
      where: { vendorId: vendor.id },
      select: { id: true, outstandingAmount: true, creditLimitAmount: true, status: true },
    });

    const khataSummary = {
      totalOutstanding: khataAccounts.reduce((s, a) => s.add(a.outstandingAmount), new Prisma.Decimal(0)),
      totalCreditLimit: khataAccounts.reduce((s, a) => s.add(a.creditLimitAmount), new Prisma.Decimal(0)),
      activeAccounts: khataAccounts.filter((a) => a.status === 'ACTIVE').length,
      overdueAccounts: khataAccounts.filter((a) => a.status === 'OVERDUE').length,
    };

    const commissionWhere: Prisma.VendorCommissionWhereInput = { vendorId: vendor.id };
    if (dateFilter) commissionWhere.createdAt = dateFilter as any;
    const commissionAgg = await prisma.vendorCommission.aggregate({
      where: commissionWhere,
      _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
      _count: true,
    });

    return {
      totalSales: Number(orderAgg._sum.totalAmount || 0),
      totalOrders: orderAgg._count,
      topProducts: topProductDetails,
      khataSummary: {
        totalOutstanding: Number(khataSummary.totalOutstanding),
        totalCreditLimit: Number(khataSummary.totalCreditLimit),
        activeAccounts: khataSummary.activeAccounts,
        overdueAccounts: khataSummary.overdueAccounts,
      },
      commissions: {
        totalGrossAmount: Number(commissionAgg._sum.grossAmount || 0),
        totalCommissionAmount: Number(commissionAgg._sum.commissionAmount || 0),
        totalNetAmount: Number(commissionAgg._sum.netAmount || 0),
        count: commissionAgg._count,
      },
    };
  },

  async getAdminDashboard(filters: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = filters;
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const orderDateFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const gmvAgg = await prisma.order.aggregate({
      where: { ...orderDateFilter, status: 'DELIVERED' },
      _sum: { totalAmount: true },
    });

    const revenueAgg = await prisma.vendorCommission.aggregate({
      where: Object.keys(dateFilter).length ? { createdAt: dateFilter } : {},
      _sum: { commissionAmount: true },
    });

    const [activeFarmers, activeVendors, totalUsers] = await Promise.all([
      prisma.user.count({ where: { role: 'FARMER', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'VENDOR', status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
    ]);

    const totalKhataAccounts = await prisma.khataAccount.count();
    const overdueKhataAccounts = await prisma.khataAccount.count({ where: { status: 'OVERDUE' } });

    const totalOrders = Object.keys(dateFilter).length
      ? await prisma.order.count({ where: { createdAt: dateFilter } as any })
      : await prisma.order.count();
    const deliveredOrders = await prisma.order.count({ where: { ...orderDateFilter, status: 'DELIVERED' } });
    const cancelledOrders = await prisma.order.count({ where: { ...orderDateFilter, status: 'CANCELLED' } });

    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, fullName: true, role: true, createdAt: true },
    });

    return {
      gmv: Number(gmvAgg._sum.totalAmount || 0),
      platformRevenue: Number(revenueAgg._sum.commissionAmount || 0),
      users: { total: totalUsers, farmers: activeFarmers, vendors: activeVendors },
      khata: {
        totalAccounts: totalKhataAccounts, overdueAccounts: overdueKhataAccounts,
        defaultRate: totalKhataAccounts > 0 ? ((overdueKhataAccounts / totalKhataAccounts) * 100).toFixed(1) : '0.0',
      },
      orders: {
        total: totalOrders, delivered: deliveredOrders, cancelled: cancelledOrders,
        conversionRate: totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '0.0',
      },
      recentRegistrations: recentUsers,
    };
  },

  async getSalesReport(vendorUserId: string | null, filters: { page: number; limit: number; startDate?: string; endDate?: string; categoryId?: string }) {
    const { page, limit, startDate, endDate, categoryId } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = { status: 'DELIVERED' };
    if (vendorUserId) {
      const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
      if (vendor) where.items = { some: { variant: { product: { vendorId: vendor.id } } } };
    }
    if (categoryId) where.items = { ...where.items as any, some: { ...(where.items as any)?.some, variant: { product: { ...(where.items as any)?.some?.variant?.product, categoryId } } } };
    const dateFilterFields: Record<string, Date> = {};
    if (startDate) dateFilterFields.gte = new Date(startDate);
    if (endDate) dateFilterFields.lte = new Date(endDate);
    if (Object.keys(dateFilterFields).length) where.createdAt = dateFilterFields as any;

    const [orders, total, amountAgg] = await Promise.all([
      prisma.order.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { items: { include: { variant: { include: { product: { select: { name: true, slug: true } } } } } }, user: { select: { fullName: true } } },
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({ where, _sum: { totalAmount: true }, _count: true }),
    ]);

    const summary = { totalAmount: Number(amountAgg._sum.totalAmount || 0), totalOrders: amountAgg._count };
    return { orders, summary, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getProductPerformance(filters: { page: number; limit: number; startDate?: string; endDate?: string; categoryId?: string; vendorId?: string }) {
    const { page, limit, startDate, endDate, categoryId, vendorId } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (vendorId) where.vendorId = vendorId;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit,
        include: {
          category: { select: { name: true } },
          vendor: { select: { businessName: true } },
          variants: { select: { id: true, sku: true, stockQuantity: true, reservedQty: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    const enriched = await Promise.all(
      products.map(async (product) => {
        const variantIds = product.variants.map((v) => v.id);
        const orderAgg = await prisma.orderItem.aggregate({
          where: { variantId: { in: variantIds } },
          _sum: { quantity: true },
        });
        return { ...product, totalSold: Number(orderAgg._sum.quantity || 0), inStock: product.variants.reduce((s, v) => s + (v.stockQuantity - v.reservedQty), 0) };
      }),
    );
    return { products: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getKhataOverdueReport(filters: { page: number; limit: number; minOverdueDays: number }) {
    const { page, limit, minOverdueDays } = filters;
    const skip = (page - 1) * limit;
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - minOverdueDays);
    const where: Prisma.KhataAccountWhereInput = { status: { in: ['OVERDUE', 'ACTIVE'] }, dueDateNextPayment: { lte: overdueDate } };

    const [accounts, total] = await Promise.all([
      prisma.khataAccount.findMany({
        where, skip, take: limit, orderBy: { dueDateNextPayment: 'asc' },
        include: { vendor: { select: { businessName: true } }, farmer: { select: { user: { select: { fullName: true, phoneNumber: true } } } } },
      }),
      prisma.khataAccount.count({ where }),
    ]);
    return { accounts, total, page, limit, totalPages: Math.ceil(total / limit) };
  },  // ── Market Intelligence ────────────────────────────────────────────────────

  async getMarketIntelligence(filters: {
    startDate?: string; endDate?: string;
    trendingPage?: number; trendingLimit?: number;
    topSellingPage?: number; topSellingLimit?: number;
    searchesPage?: number; searchesLimit?: number;
    categoriesPage?: number; categoriesLimit?: number;
  }) {
    const { startDate, endDate } = filters;
    const trendingPage = filters.trendingPage || 1;
    const trendingLimit = filters.trendingLimit || 10;
    const topSellingPage = filters.topSellingPage || 1;
    const topSellingLimit = filters.topSellingLimit || 10;
    const searchesPage = filters.searchesPage || 1;
    const searchesLimit = filters.searchesLimit || 10;
    const categoriesPage = filters.categoriesPage || 1;
    const categoriesLimit = filters.categoriesLimit || 10;

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    if (!startDate && !endDate) {
      // Default: last 30 days
      dateFilter.gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const viewDateFilter = hasDateFilter ? { viewedAt: dateFilter } : {};
    const searchDateFilter = hasDateFilter ? { searchedAt: dateFilter } : {};
    const orderDateFilter = hasDateFilter ? { createdAt: dateFilter } : {};

    // 1. Trending products (most viewed) — paginated
    const trendingSkip = (trendingPage - 1) * trendingLimit;
    const trendingViews = await prisma.productView.groupBy({
      by: ['productId'],
      where: viewDateFilter as any,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const trendingTotal = trendingViews.length;
    const trendingPaged = trendingViews.slice(trendingSkip, trendingSkip + trendingLimit);

    const trendingProductIds = trendingPaged.map((v) => v.productId);
    const trendingProducts = trendingProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: trendingProductIds } },
          select: {
            id: true, name: true, slug: true,
            category: { select: { name: true } },
            vendor: { select: { businessName: true } },
            images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
          },
        })
      : [];

    const trendingWithViews = trendingProducts.map((p) => ({
      ...p,
      viewCount: trendingViews.find((v) => v.productId === p.id)?._count.id ?? 0,
    })).sort((a, b) => b.viewCount - a.viewCount);

    // 2. Popular search keywords — paginated
    const searchesSkip = (searchesPage - 1) * searchesLimit;
    const allSearches = await prisma.searchHistory.groupBy({
      by: ['keyword'],
      where: searchDateFilter as any,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const searchesTotal = allSearches.length;
    const popularSearches = allSearches
      .slice(searchesSkip, searchesSkip + searchesLimit)
      .map((s) => ({ keyword: s.keyword, count: s._count.id }));

    // 3. Category performance (sales in period) — paginated
    const categoriesSkip = (categoriesPage - 1) * categoriesLimit;
    const ordersInPeriod = hasDateFilter
      ? await prisma.order.findMany({
          where: {
            status: 'DELIVERED',
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: {
            createdAt: true,
            items: {
              select: {
                quantity: true,
                unitPrice: true,
                variant: { select: { product: { select: { categoryId: true, category: { select: { name: true } } } } } },
              },
            },
          },
        })
      : [];

    const categoryMap = new Map<string, { name: string; totalSales: number; totalQty: number; orderCount: number }>();
    for (const order of ordersInPeriod) {
      for (const item of order.items) {
        const catId = item.variant.product.categoryId;
        const catName = item.variant.product.category.name;
        const lineTotal = Number(item.unitPrice) * item.quantity;
        if (categoryMap.has(catId)) {
          const c = categoryMap.get(catId)!;
          c.totalSales += lineTotal;
          c.totalQty += item.quantity;
          c.orderCount += 1;
        } else {
          categoryMap.set(catId, { name: catName, totalSales: lineTotal, totalQty: item.quantity, orderCount: 1 });
        }
      }
    }

    const allCategories = Array.from(categoryMap.entries())
      .map(([id, data]) => ({ categoryId: id, ...data }))
      .sort((a, b) => b.totalSales - a.totalSales);
    const categoriesTotal = allCategories.length;
    const categoryPerformance = allCategories.slice(categoriesSkip, categoriesSkip + categoriesLimit);

    // 4. Top selling products — paginated
    const topSellingSkip = (topSellingPage - 1) * topSellingLimit;
    const allTopSellingItems = await prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        order: {
          status: 'DELIVERED',
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
    });
    const topSellingTotal = allTopSellingItems.length;
    const topSellingPaged = allTopSellingItems.slice(topSellingSkip, topSellingSkip + topSellingLimit);

    const variantIds = topSellingPaged.map((i) => i.variantId);
    const variants = variantIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true, sku: true, variantName: true, sellingPrice: true,
            product: { select: { id: true, name: true, slug: true, category: { select: { name: true } }, vendor: { select: { businessName: true } } } },
          },
        })
      : [];

    const topSellingProducts = topSellingPaged.map((i) => {
      const v = variants.find((v) => v.id === i.variantId);
      return {
        variantId: i.variantId,
        productName: v?.product.name ?? 'Unknown',
        productSlug: v?.product.slug ?? '',
        variantName: v?.variantName ?? 'Default',
        sku: v?.sku ?? '',
        sellingPrice: Number(v?.sellingPrice ?? 0),
        categoryName: v?.product.category.name ?? '',
        vendorName: v?.product.vendor.businessName ?? '',
        totalSold: i._sum.quantity ?? 0,
      };
    }).sort((a, b) => b.totalSold - a.totalSold);

    // 5. Sales trend (daily for the period)
    const daysInPeriod = 30;
    const salesByDay: { date: string; sales: number; orders: number }[] = [];
    for (let i = daysInPeriod - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayOrders = ordersInPeriod.filter(
        (o) => o.createdAt >= dayStart && o.createdAt < dayEnd
      );
      const daySales = dayOrders.reduce((sum, o) => {
        return sum + o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
      }, 0);

      salesByDay.push({
        date: dayStart.toISOString().slice(0, 10),
        sales: daySales,
        orders: dayOrders.length,
      });
    }

    // 6. Summary stats
    const totalSales = ordersInPeriod.reduce((sum, o) => {
      return sum + o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    }, 0);

    return {
      summary: {
        totalSales,
        totalOrders: ordersInPeriod.length,
        totalProductsViewed: trendingTotal,
        totalSearches: allSearches.reduce((s, k) => s + k._count.id, 0),
      },
      trendingProducts: {
        items: trendingWithViews,
        pagination: {
          page: trendingPage,
          limit: trendingLimit,
          total: trendingTotal,
          totalPages: Math.ceil(trendingTotal / trendingLimit),
        },
      },
      popularSearches: {
        items: popularSearches,
        pagination: {
          page: searchesPage,
          limit: searchesLimit,
          total: searchesTotal,
          totalPages: Math.ceil(searchesTotal / searchesLimit),
        },
      },
      categoryPerformance: {
        items: categoryPerformance,
        pagination: {
          page: categoriesPage,
          limit: categoriesLimit,
          total: categoriesTotal,
          totalPages: Math.ceil(categoriesTotal / categoriesLimit),
        },
      },
      topSellingProducts: {
        items: topSellingProducts,
        pagination: {
          page: topSellingPage,
          limit: topSellingLimit,
          total: topSellingTotal,
          totalPages: Math.ceil(topSellingTotal / topSellingLimit),
        },
      },
      salesTrend: salesByDay,
    };
  },

  async exportUserData(userId: string, types: string[]) {
    const result: Record<string, any> = {};
    if (types.includes('profile')) {
      result.profile = await prisma.user.findUnique({ where: { id: userId }, include: { farmerProfile: true, vendorProfile: true, addresses: true } });
    }
    if (types.includes('orders')) {
      result.orders = await prisma.order.findMany({ where: { userId }, include: { items: true, statusHistory: true, payments: true }, orderBy: { createdAt: 'desc' } });
    }
    if (types.includes('khata')) {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { farmerProfile: true } });
      if (user?.farmerProfile) {
        result.khata = await prisma.khataAccount.findMany({ where: { farmerId: user.farmerProfile.id }, include: { transactions: { take: 100, orderBy: { createdAt: 'desc' } } } });
      } else { result.khata = []; }
    }
    if (types.includes('reviews')) {
      result.reviews = await prisma.review.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    }
    if (types.includes('wallet')) {
      result.wallet = await prisma.wallet.findUnique({ where: { userId }, include: { transactions: { take: 100, orderBy: { createdAt: 'desc' } } } });
    }
    return { userId, exportedAt: new Date().toISOString(), data: result };
  }
};