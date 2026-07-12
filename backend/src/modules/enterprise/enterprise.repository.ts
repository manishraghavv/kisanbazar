import { injectable } from 'tsyringe';
import { BaseRepository } from '../../common/lib/base.repository';

@injectable()
export class EnterpriseRepository extends BaseRepository {
  // ── Industry ──────────────────────────────────────────────────────────────
  createIndustry(data: any) { return this.prisma.industry.create({ data }); }
  findIndustryById(id: string) { return this.prisma.industry.findUnique({ where: { id }, include: { _count: { select: { vendors: true } } } }); }
  findIndustryBySlug(slug: string) { return this.prisma.industry.findUnique({ where: { slug } }); }
  updateIndustry(id: string, data: any) { return this.prisma.industry.update({ where: { id }, data }); }
  listIndustries(where: any, skip: number, take: number) { return this.prisma.industry.findMany({ where, skip, take, orderBy: { name: 'asc' } }); }
  countIndustries(where: any) { return this.prisma.industry.count({ where }); }

  // ── Enterprise Tier ───────────────────────────────────────────────────────
  createTier(data: any) { return this.prisma.enterpriseTier.create({ data }); }
  findTierById(id: string) { return this.prisma.enterpriseTier.findUnique({ where: { id }, include: { _count: { select: { vendors: true } } } }); }
  findTierBySize(size: string) { return this.prisma.enterpriseTier.findUnique({ where: { size: size as any } }); }
  updateTier(id: string, data: any) { return this.prisma.enterpriseTier.update({ where: { id }, data }); }
  listTiers() { return this.prisma.enterpriseTier.findMany({ orderBy: { size: 'asc' } }); }

  // ── Vendor ────────────────────────────────────────────────────────────────
  findVendorById(id: string, include?: any) { return this.prisma.vendor.findUnique({ where: { id }, ...(include ? { include } : {}) }); }
  findVendorByUserId(userId: string, include?: any) { return this.prisma.vendor.findUnique({ where: { userId }, ...(include ? { include } : {}) }); }
  updateVendor(id: string, data: any) { return this.prisma.vendor.update({ where: { id }, data }); }

  // ── Audit Logs ────────────────────────────────────────────────────────────
  createAuditLog(data: any) { return this.prisma.auditLog.create({ data }); }
  listAuditLogs(where: any, skip: number, take: number) { return this.prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }); }
  countAuditLogs(where: any) { return this.prisma.auditLog.count({ where }); }

  // ── Analytics ─────────────────────────────────────────────────────────────
  createProductView(data: any) { return this.prisma.productView.create({ data }); }
  createSearchHistory(data: any) { return this.prisma.searchHistory.create({ data }); }
  aggregateOrders(where: any) { return this.prisma.order.aggregate({ where, _sum: { totalAmount: true }, _count: true }); }
  countOrders(where: any) { return this.prisma.order.count({ where }); }
  groupOrderItems(where: any, take: number) { return this.prisma.orderItem.groupBy({ by: ['variantId'], where, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take }); }
  findKhataAccountsByVendor(vendorId: string) { return this.prisma.khataAccount.findMany({ where: { vendorId }, select: { id: true, outstandingAmount: true, creditLimitAmount: true, status: true } }); }
  aggregateCommissions(where: any) { return this.prisma.vendorCommission.aggregate({ where, _sum: { grossAmount: true, commissionAmount: true, netAmount: true }, _count: true }); }
  aggregateDeliveredGmv(where: any) { return this.prisma.order.aggregate({ where: { ...where, status: 'DELIVERED' }, _sum: { totalAmount: true } }); }
  aggregateCommissionRevenue(where: any) { return this.prisma.vendorCommission.aggregate({ where, _sum: { commissionAmount: true } }); }
  countUsers(where: any) { return this.prisma.user.count({ where }); }
  countKhataAccounts(where: any) { return this.prisma.khataAccount.count({ where }); }
  findRecentUsers(days: number) { return this.prisma.user.findMany({ where: { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, fullName: true, role: true, createdAt: true } }); }
  listDeliveredOrders(where: any, skip: number, take: number) { return this.prisma.order.findMany({ where: { ...where, status: 'DELIVERED' }, skip, take, orderBy: { createdAt: 'desc' }, include: { items: { include: { variant: { include: { product: { select: { name: true, slug: true } } } } } }, user: { select: { fullName: true } } } }); }
  countDeliveredOrders(where: any) { return this.prisma.order.count({ where: { ...where, status: 'DELIVERED' } }); }
  listProductsWithDetails(where: any, skip: number, take: number) { return this.prisma.product.findMany({ where, skip, take, include: { _count: { select: { views: true, reviews: true } }, category: { select: { name: true } }, vendor: { select: { businessName: true } }, variants: { select: { id: true, sku: true, stockQuantity: true, reservedQty: true } } }, orderBy: { createdAt: 'desc' } }); }
  countProducts(where: any) { return this.prisma.product.count({ where }); }
  aggregateOrderItemQuantity(variantIds: string[]) { return this.prisma.orderItem.aggregate({ where: { variantId: { in: variantIds } }, _sum: { quantity: true } }); }
  listOverdueKhata(where: any, skip: number, take: number) { return this.prisma.khataAccount.findMany({ where, skip, take, orderBy: { dueDateNextPayment: 'asc' }, include: { vendor: { select: { businessName: true } }, farmer: { select: { user: { select: { fullName: true, phoneNumber: true } } } } } }); }
  countOverdueKhata(where: any) { return this.prisma.khataAccount.count({ where }); }
  findUser(userId: string, include?: any) { return this.prisma.user.findUnique({ where: { id: userId }, ...(include ? { include } : {}) }); }
  listUserOrders(userId: string) { return this.prisma.order.findMany({ where: { userId }, include: { items: true, statusHistory: true, payments: true }, orderBy: { createdAt: 'desc' } }); }
  listFarmerKhata(farmerId: string) { return this.prisma.khataAccount.findMany({ where: { farmerId }, include: { transactions: { take: 100, orderBy: { createdAt: 'desc' } } } }); }
  listUserReviews(userId: string) { return this.prisma.review.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  findWalletByUserId(userId: string, include?: any) { return this.prisma.wallet.findUnique({ where: { userId }, ...(include ? { include } : {}) }); }
}
