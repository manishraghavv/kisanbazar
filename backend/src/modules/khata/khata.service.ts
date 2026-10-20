import { KhataStatus, KhataTransactionType, KhataRequestStatus, Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { ForbiddenError, NotFoundError, ConflictError, BadRequestError } from '../../common/errors';

export const KhataService = {
  // ── Accounts ──────────────────────────────────────────────────────────────

  async createAccount(
    vendorUserId: string,
    farmerId: string,
    data: {
      creditLimitAmount: number;
      interestRatePct?: number;
      creditPeriodDays?: number;
    },
  ) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');

    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) throw new NotFoundError('Farmer not found');

    const existing = await prisma.khataAccount.findUnique({
      where: { vendorId_farmerId: { vendorId: vendor.id, farmerId } },
    });
    if (existing) throw new ConflictError('Khata account already exists for this vendor-farmer pair');

    return prisma.khataAccount.create({
      data: {
        vendorId: vendor.id,
        farmerId,
        creditLimitAmount: new Prisma.Decimal(data.creditLimitAmount),
        interestRatePct: new Prisma.Decimal(data.interestRatePct ?? 0),
        creditPeriodDays: data.creditPeriodDays ?? 30,
      },
      include: {
        vendor: { select: { businessName: true } },
        farmer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
      },
    });
  },

  async getAccounts(
    requesterId: string,
    requesterRole: string,
    filters: {
      page: number;
      limit: number;
      status?: KhataStatus;
      farmerId?: string;
      vendorId?: string;
    },
  ) {
    const { page, limit, status, farmerId, vendorId } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.KhataAccountWhereInput = {};

    if (requesterRole === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: requesterId } });
      if (!vendor) throw new ForbiddenError('Vendor profile not found');
      where.vendorId = vendor.id;
    } else if (requesterRole === 'FARMER') {
      const farmer = await prisma.farmer.findUnique({ where: { userId: requesterId } });
      if (!farmer) throw new ForbiddenError('Farmer profile not found');
      where.farmerId = farmer.id;
    } else {
      if (vendorId) where.vendorId = vendorId;
      if (farmerId) where.farmerId = farmerId;
    }

    if (status) where.status = status;

    const [accounts, total] = await Promise.all([
      prisma.khataAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          vendor: { select: { businessName: true } },
          farmer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
        },
      }),
      prisma.khataAccount.count({ where }),
    ]);

    return { accounts, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getAccountById(id: string, requesterId: string, requesterRole: string) {
    const account = await prisma.khataAccount.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, businessName: true, userId: true } },
        farmer: { select: { id: true, userId: true, user: { select: { fullName: true, phoneNumber: true } } } },
      },
    });
    if (!account) throw new NotFoundError('Khata account not found');

    KhataService._assertAccess(account, requesterId, requesterRole);
    return account;
  },

  async updateAccount(
    id: string,
    requesterId: string,
    requesterRole: string,
    data: {
      creditLimitAmount?: number;
      interestRatePct?: number;
      creditPeriodDays?: number;
      status?: KhataStatus;
    },
  ) {
    const account = await prisma.khataAccount.findUnique({
      where: { id },
      include: { vendor: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');

    if (requesterRole === 'VENDOR' && account.vendor.userId !== requesterId) {
      throw new ForbiddenError('Access denied');
    }
    if (requesterRole === 'FARMER') throw new ForbiddenError('Farmers cannot update khata terms');

    const updateData: Prisma.KhataAccountUpdateInput = {};
    if (data.creditLimitAmount !== undefined) updateData.creditLimitAmount = new Prisma.Decimal(data.creditLimitAmount);
    if (data.interestRatePct !== undefined) updateData.interestRatePct = new Prisma.Decimal(data.interestRatePct);
    if (data.creditPeriodDays !== undefined) updateData.creditPeriodDays = data.creditPeriodDays;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.khataAccount.update({ where: { id }, data: updateData });
  },

  // ── Transactions ──────────────────────────────────────────────────────────

  async addTransaction(
    accountId: string,
    performerId: string,
    performerRole: string,
    data: {
      type: KhataTransactionType;
      amount: number;
      linkedOrderId?: string;
      remarks?: string;
      proofImageUrl?: string;
      upiTransactionId?: string;
    },
  ) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: { vendor: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    if (account.status === 'SUSPENDED' || account.status === 'WRITTEN_OFF') {
      throw new BadRequestError(`Cannot add transaction to a ${account.status.toLowerCase()} account`);
    }

    if (performerRole === 'VENDOR' && account.vendor.userId !== performerId) {
      throw new ForbiddenError('Access denied');
    }
    if (performerRole === 'FARMER') throw new ForbiddenError('Farmers cannot record transactions directly');

    const amount = new Prisma.Decimal(data.amount);
    const isDebit = ['UDHAR_DIYA', 'INTEREST_LAGA', 'ORDER_LINKED'].includes(data.type);
    const newOutstanding = isDebit ? account.outstandingAmount.add(amount) : account.outstandingAmount.sub(amount);

    if (isDebit && newOutstanding.gt(account.creditLimitAmount)) {
      throw new BadRequestError(`Transaction would exceed credit limit of ₹${account.creditLimitAmount}`);
    }

    const now = new Date();
    const [transaction] = await prisma.$transaction([
      prisma.khataTransaction.create({
        data: {
          khataAccountId: accountId,
          type: data.type,
          amount,
          balanceAfter: newOutstanding,
          linkedOrderId: data.linkedOrderId,
          performedById: performerId,
          remarks: data.remarks,
          proofImageUrl: data.proofImageUrl,
          upiTransactionId: data.upiTransactionId,
        },
      }),
      prisma.khataAccount.update({
        where: { id: accountId },
        data: {
          outstandingAmount: newOutstanding,
          lastTransactionAt: now,
          status: newOutstanding.lte(0) ? 'SETTLED' : 'ACTIVE',
          dueDateNextPayment: isDebit
            ? new Date(now.getTime() + account.creditPeriodDays * 24 * 60 * 60 * 1000)
            : undefined,
        },
      }),
    ]);

    return transaction;
  },

  async getTransactions(
    accountId: string,
    requesterId: string,
    requesterRole: string,
    filters: {
      page: number;
      limit: number;
      type?: KhataTransactionType;
    },
  ) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: { vendor: { select: { userId: true } }, farmer: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    KhataService._assertAccess(account, requesterId, requesterRole);

    const { page, limit, type } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.KhataTransactionWhereInput = { khataAccountId: accountId };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.khataTransaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.khataTransaction.count({ where }),
    ]);

    return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  // ── Credit Requests ───────────────────────────────────────────────────────

  async getRequests(
    accountId: string,
    requesterId: string,
    requesterRole: string,
    filters: {
      page: number;
      limit: number;
    },
  ) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: { vendor: { select: { userId: true } }, farmer: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    KhataService._assertAccess(account, requesterId, requesterRole);

    const { page, limit } = filters;
    const skip = (page - 1) * limit;
    const where = { khataAccountId: accountId };

    const [requests, total] = await Promise.all([
      prisma.khataRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.khataRequest.count({ where }),
    ]);

    return { requests, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async createRequest(
    accountId: string,
    farmerUserId: string,
    data: {
      requestedLimit: number;
      reason?: string;
    },
  ) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: { farmer: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    if (account.farmer.userId !== farmerUserId) throw new ForbiddenError('Access denied');
    if (account.status !== 'ACTIVE') throw new BadRequestError('Can only request limit increase on an active account');

    const pending = await prisma.khataRequest.findFirst({
      where: { khataAccountId: accountId, status: 'PENDING' },
    });
    if (pending) throw new ConflictError('A pending credit request already exists for this account');

    return prisma.khataRequest.create({
      data: {
        khataAccountId: accountId,
        requestedById: farmerUserId,
        requestedLimit: new Prisma.Decimal(data.requestedLimit),
        currentLimit: account.creditLimitAmount,
        reason: data.reason,
      },
    });
  },

  async reviewRequest(
    requestId: string,
    reviewerId: string,
    reviewerRole: string,
    data: {
      status: 'APPROVED' | 'REJECTED';
      reviewNote?: string;
    },
  ) {
    const request = await prisma.khataRequest.findUnique({
      where: { id: requestId },
      include: { khataAccount: { include: { vendor: { select: { userId: true } } } } },
    });
    if (!request) throw new NotFoundError('Khata request not found');
    if (request.status !== 'PENDING') throw new BadRequestError('Request has already been reviewed');

    if (reviewerRole === 'VENDOR' && request.khataAccount.vendor.userId !== reviewerId) {
      throw new ForbiddenError('Access denied');
    }
    if (reviewerRole === 'FARMER') throw new ForbiddenError('Farmers cannot review credit requests');

    const updates: Prisma.PrismaPromise<unknown>[] = [
      prisma.khataRequest.update({
        where: { id: requestId },
        data: {
          status: data.status as KhataRequestStatus,
          reviewedById: reviewerId,
          reviewNote: data.reviewNote,
          reviewedAt: new Date(),
        },
      }),
    ];

    if (data.status === 'APPROVED') {
      updates.push(
        prisma.khataAccount.update({
          where: { id: request.khataAccountId },
          data: { creditLimitAmount: request.requestedLimit },
        }),
      );
    }

    await prisma.$transaction(updates);
    return { message: `Request ${data.status.toLowerCase()} successfully` };
  },

  // ── Statements ────────────────────────────────────────────────────────────

  async getStatements(accountId: string, requesterId: string, requesterRole: string) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: { vendor: { select: { userId: true } }, farmer: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    KhataService._assertAccess(account, requesterId, requesterRole);

    return prisma.khataStatement.findMany({
      where: { khataAccountId: accountId },
      orderBy: { periodStart: 'desc' },
    });
  },

  async getStatementById(accountId: string, statementId: string, requesterId: string, requesterRole: string) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: { vendor: { select: { userId: true } }, farmer: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    KhataService._assertAccess(account, requesterId, requesterRole);

    const statement = await prisma.khataStatement.findFirst({
      where: { id: statementId, khataAccountId: accountId },
    });
    if (!statement) throw new NotFoundError('Statement not found');
    return statement;
  },

  async generateStatement(
    accountId: string,
    requesterId: string,
    requesterRole: string,
    data: {
      periodStart: Date;
      periodEnd: Date;
    },
  ) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: { vendor: { select: { userId: true } }, farmer: { select: { userId: true } } },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    KhataService._assertAccess(account, requesterId, requesterRole);

    const transactions = await prisma.khataTransaction.findMany({
      where: {
        khataAccountId: accountId,
        createdAt: { gte: data.periodStart, lte: data.periodEnd },
      },
      orderBy: { createdAt: 'asc' },
    });

    const debitTypes: KhataTransactionType[] = ['UDHAR_DIYA', 'INTEREST_LAGA', 'ORDER_LINKED'];
    const creditTypes: KhataTransactionType[] = ['WAPSI_MILI', 'WAIVER'];

    let totalDebits = new Prisma.Decimal(0);
    let totalCredits = new Prisma.Decimal(0);
    let interestCharged = new Prisma.Decimal(0);

    for (const tx of transactions) {
      if (debitTypes.includes(tx.type)) totalDebits = totalDebits.add(tx.amount);
      if (creditTypes.includes(tx.type)) totalCredits = totalCredits.add(tx.amount);
      if (tx.type === 'INTEREST_LAGA') interestCharged = interestCharged.add(tx.amount);
    }

    const prevTx = await prisma.khataTransaction.findFirst({
      where: { khataAccountId: accountId, createdAt: { lt: data.periodStart } },
      orderBy: { createdAt: 'desc' },
    });
    const openingBalance = prevTx ? prevTx.balanceAfter : new Prisma.Decimal(0);
    const closingBalance = openingBalance.add(totalDebits).sub(totalCredits);

    const statement = await prisma.khataStatement.create({
      data: {
        khataAccountId: accountId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        openingBalance,
        totalDebits,
        totalCredits,
        closingBalance,
        interestCharged,
      },
    });

    return { statement, transactions };
  },

  // ── Vendor Analytics ───────────────────────────────────────────────────────

  async getVendorAnalytics(requesterId: string, requesterRole: string) {
    if (requesterRole !== 'VENDOR' && requesterRole !== 'ADMIN') {
      throw new ForbiddenError('Only vendors and admins can view analytics');
    }

    const vendor = await prisma.vendor.findUnique({ where: { userId: requesterId } });
    if (!vendor && requesterRole !== 'ADMIN') throw new ForbiddenError('Vendor profile not found');

    const vendorId = requesterRole === 'ADMIN' ? undefined : vendor!.id;
    const accountWhere: Prisma.KhataAccountWhereInput = vendorId ? { vendorId } : {};

    // Aggregate all accounts
    const [accounts, statusCounts, totalOutstandingResult, totalLimitResult] = await Promise.all([
      prisma.khataAccount.findMany({
        where: { ...accountWhere, status: 'OVERDUE', outstandingAmount: { gt: 0 } },
        orderBy: { dueDateNextPayment: 'asc' },
        take: 20,
        include: {
          farmer: {
            select: { user: { select: { fullName: true, phoneNumber: true } } },
          },
        },
      }),
      prisma.khataAccount.groupBy({
        by: ['status'],
        where: accountWhere,
        _count: true,
      }),
      prisma.khataAccount.aggregate({
        where: accountWhere,
        _sum: { outstandingAmount: true },
      }),
      prisma.khataAccount.aggregate({
        where: accountWhere,
        _sum: { creditLimitAmount: true },
      }),
    ]);

    // Recovery metrics — get aggregate transaction data
    const creditTxns = await prisma.khataTransaction.aggregate({
      where: {
        khataAccount: vendorId ? { vendorId } : {},
        type: { in: ['UDHAR_DIYA', 'ORDER_LINKED'] },
      },
      _sum: { amount: true },
    });

    const repaymentTxns = await prisma.khataTransaction.aggregate({
      where: {
        khataAccount: vendorId ? { vendorId } : {},
        type: { in: ['WAPSI_MILI'] },
      },
      _sum: { amount: true },
    });

    const totalCreditGiven = Number(creditTxns._sum.amount ?? 0);
    const totalRepaid = Number(repaymentTxns._sum.amount ?? 0);
    const collectionRate = totalCreditGiven > 0 ? (totalRepaid / totalCreditGiven) * 100 : 100;

    // Status distribution map
    const statusMap: Record<string, number> = {
      ACTIVE: 0,
      SETTLED: 0,
      OVERDUE: 0,
      SUSPENDED: 0,
      WRITTEN_OFF: 0,
    };
    for (const row of statusCounts) {
      statusMap[row.status] = row._count;
    }

    const totalAccounts = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const totalOutstanding = Number(totalOutstandingResult._sum.outstandingAmount ?? 0);
    const totalCreditLimit = Number(totalLimitResult._sum.creditLimitAmount ?? 0);

    // Overdue with computed days
    const now = new Date();
    const overdueAccounts = accounts.map((a) => {
      const dueDate = a.dueDateNextPayment ?? now;
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        id: a.id,
        farmerName: a.farmer?.user.fullName ?? 'Unknown',
        farmerPhone: a.farmer?.user.phoneNumber ?? '',
        outstandingAmount: Number(a.outstandingAmount),
        creditLimitAmount: Number(a.creditLimitAmount),
        daysOverdue,
        dueDate: a.dueDateNextPayment?.toISOString() ?? null,
      };
    });

    const totalOverdueAmount = overdueAccounts
      .filter((a) => a.daysOverdue > 0)
      .reduce((sum, a) => sum + a.outstandingAmount, 0);

    return {
      summary: {
        totalAccounts,
        totalOutstanding,
        totalCreditLimit,
        totalOverdueAccounts: statusMap.OVERDUE,
        totalOverdueAmount,
        collectionRate: Math.round(collectionRate * 100) / 100,
        totalCreditGiven,
        totalRepaid,
        utilizationRate: totalCreditLimit > 0 ? Math.round((totalOutstanding / totalCreditLimit) * 100 * 100) / 100 : 0,
      },
      statusDistribution: statusMap,
      overdueAccounts,
    };
  },

  // ── Overdue Accounts ─────────────────────────────────────────────────────

  async getOverdueAccounts(
    requesterId: string,
    requesterRole: string,
    filters: {
      page: number;
      limit: number;
      farmerId?: string;
      minDaysOverdue: number;
    },
  ) {
    const { page, limit, farmerId, minDaysOverdue } = filters;
    const skip = (page - 1) * limit;

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - minDaysOverdue);

    const where: Prisma.KhataAccountWhereInput = {
      status: 'OVERDUE',
      outstandingAmount: { gt: 0 },
      dueDateNextPayment: { lte: thresholdDate },
    };

    if (requesterRole === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: requesterId } });
      if (!vendor) throw new ForbiddenError('Vendor profile not found');
      where.vendorId = vendor.id;
    }

    if (farmerId) where.farmerId = farmerId;

    const [accounts, total] = await Promise.all([
      prisma.khataAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDateNextPayment: 'asc' },
        include: {
          vendor: { select: { id: true, businessName: true } },
          farmer: {
            select: {
              id: true,
              user: { select: { fullName: true, phoneNumber: true } },
            },
          },
        },
      }),
      prisma.khataAccount.count({ where }),
    ]);

    return { accounts, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  // ── PDF Statement ─────────────────────────────────────────────────────────

  async getStatementPdfData(accountId: string, requesterId: string, requesterRole: string) {
    const account = await prisma.khataAccount.findUnique({
      where: { id: accountId },
      include: {
        vendor: { select: { userId: true, businessName: true, gstNumber: true } },
        farmer: {
          select: {
            userId: true,
            village: true,
            user: { select: { fullName: true, phoneNumber: true } },
          },
        },
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!account) throw new NotFoundError('Khata account not found');
    KhataService._assertAccess(account, requesterId, requesterRole);
    return account;
  },

  // ── Admin Khata Overview ─────────────────────────────────────────────────

  async getAdminOverview() {
    const [totalAccounts, statusCounts, totalOutstandingResult, totalLimitResult, overdueAccounts, vendorStats] =
      await Promise.all([
        prisma.khataAccount.count(),
        prisma.khataAccount.groupBy({
          by: ['status'],
          _count: true,
        }),
        prisma.khataAccount.aggregate({
          _sum: { outstandingAmount: true },
        }),
        prisma.khataAccount.aggregate({
          _sum: { creditLimitAmount: true },
        }),
        prisma.khataAccount.findMany({
          where: { status: 'OVERDUE', outstandingAmount: { gt: 0 } },
          orderBy: { dueDateNextPayment: 'asc' },
          take: 20,
          include: {
            vendor: { select: { businessName: true } },
            farmer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
          },
        }),
        prisma.khataAccount.groupBy({
          by: ['vendorId'],
          _count: true,
          _sum: { outstandingAmount: true, creditLimitAmount: true },
          orderBy: { _sum: { outstandingAmount: 'desc' } },
          take: 20,
        }),
      ]);

    const statusMap: Record<string, number> = {
      ACTIVE: 0,
      SETTLED: 0,
      OVERDUE: 0,
      SUSPENDED: 0,
      WRITTEN_OFF: 0,
    };
    for (const row of statusCounts) {
      statusMap[row.status] = row._count;
    }

    const totalOutstanding = Number(totalOutstandingResult._sum.outstandingAmount ?? 0);
    const totalCreditLimit = Number(totalLimitResult._sum.creditLimitAmount ?? 0);

    // Get vendor names for vendor stats
    const vendorIds = vendorStats.map((v) => v.vendorId);
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, businessName: true },
    });
    const vendorMap = new Map(vendors.map((v) => [v.id, v.businessName]));

    const now = new Date();
    const nowMs = now.getTime();

    const overdueList = overdueAccounts.map((a) => ({
      id: a.id,
      vendorName: a.vendor?.businessName ?? 'Unknown',
      farmerName: a.farmer?.user.fullName ?? 'Unknown',
      farmerPhone: a.farmer?.user.phoneNumber ?? '',
      outstandingAmount: Number(a.outstandingAmount),
      daysOverdue: a.dueDateNextPayment
        ? Math.max(0, Math.floor((nowMs - a.dueDateNextPayment.getTime()) / (1000 * 60 * 60 * 24)))
        : 0,
    }));

    const vendorBreakdown = vendorStats.map((v) => ({
      vendorId: v.vendorId,
      businessName: vendorMap.get(v.vendorId) ?? 'Unknown',
      accountCount: v._count,
      totalOutstanding: Number(v._sum.outstandingAmount ?? 0),
      totalCreditLimit: Number(v._sum.creditLimitAmount ?? 0),
    }));

    return {
      summary: {
        totalAccounts,
        totalOutstanding,
        totalCreditLimit,
        totalOverdueAccounts: statusMap.OVERDUE,
        utilizationRate: totalCreditLimit > 0 ? Math.round((totalOutstanding / totalCreditLimit) * 100 * 100) / 100 : 0,
        avgOutstanding: totalAccounts > 0 ? Math.round(totalOutstanding / totalAccounts) : 0,
      },
      statusDistribution: statusMap,
      overdueAccounts: overdueList,
      vendorBreakdown,
    };
  },

  // ── Overdue Trends ──────────────────────────────────────────────────────

  async getOverdueTrends(requesterId: string, requesterRole: string) {
    if (requesterRole !== 'VENDOR' && requesterRole !== 'ADMIN') {
      throw new ForbiddenError('Only vendors and admins can view overdue trends');
    }

    const vendor = await prisma.vendor.findUnique({ where: { userId: requesterId } });
    if (!vendor && requesterRole !== 'ADMIN') throw new ForbiddenError('Vendor profile not found');

    const vendorId = requesterRole === 'ADMIN' ? undefined : vendor!.id;

    // Get transactions that increase debt (UDHAR_DIYA, ORDER_LINKED, INTEREST_LAGA)
    // grouped by month for the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const where: Prisma.KhataTransactionWhereInput = {
      type: { in: ['UDHAR_DIYA', 'ORDER_LINKED', 'INTEREST_LAGA'] },
      createdAt: { gte: twelveMonthsAgo },
    };
    if (vendorId) where.khataAccount = { vendorId };

    const debitTxns = await prisma.khataTransaction.findMany({
      where,
      select: { amount: true, createdAt: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    // Get repayment transactions for recovery rate calculation
    const repayWhere: Prisma.KhataTransactionWhereInput = {
      type: 'WAPSI_MILI',
      createdAt: { gte: twelveMonthsAgo },
    };
    if (vendorId) repayWhere.khataAccount = { vendorId };

    const repayTxns = await prisma.khataTransaction.findMany({
      where: repayWhere,
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Build monthly buckets for last 12 months
    const monthlyData: Array<{
      month: string;
      debitAmount: number;
      debitCount: number;
      repaymentAmount: number;
      repaymentCount: number;
    }> = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = monthStart.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthDebits = debitTxns.filter((tx) => tx.createdAt >= monthStart && tx.createdAt <= monthEnd);
      const monthRepays = repayTxns.filter((tx) => tx.createdAt >= monthStart && tx.createdAt <= monthEnd);

      monthlyData.push({
        month: monthLabel,
        debitAmount: monthDebits.reduce((s, tx) => s + Number(tx.amount), 0),
        debitCount: monthDebits.length,
        repaymentAmount: monthRepays.reduce((s, tx) => s + Number(tx.amount), 0),
        repaymentCount: monthRepays.length,
      });
    }

    // Compute cumulative outstanding trend by walking forward through monthly data
    const currentOutstandingAgg = await prisma.khataAccount.aggregate({
      where: vendorId ? { vendorId } : {},
      _sum: { outstandingAmount: true },
    });
    const currentOutstanding = Number(currentOutstandingAgg._sum.outstandingAmount ?? 0);

    // First pass: compute net debit per month (oldest to newest)
    const tempNetByMonth: Array<{ month: string; net: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = monthStart.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthDebits = debitTxns.filter((tx) => tx.createdAt >= monthStart && tx.createdAt <= monthEnd);
      const monthRepays = repayTxns.filter((tx) => tx.createdAt >= monthStart && tx.createdAt <= monthEnd);
      const net =
        monthDebits.reduce((s, tx) => s + Number(tx.amount), 0) -
        monthRepays.reduce((s, tx) => s + Number(tx.amount), 0);

      tempNetByMonth.push({ month: monthLabel, net });
    }

    // Compute starting balance before the 12-month window
    const totalNet = tempNetByMonth.reduce((s, m) => s + m.net, 0);
    let runningBalance = Math.max(0, currentOutstanding - totalNet);

    // Walk forward: add each month's net to get outstanding at end of that month
    const outstandingTrend = tempNetByMonth.map((m) => {
      runningBalance += m.net;
      return { month: m.month, netOutstanding: Math.round(Math.max(0, runningBalance)) };
    });

    return {
      monthlyDebits: monthlyData,
      outstandingTrend,
    };
  },

  // ── Internal helper ───────────────────────────────────────────────────────

  _assertAccess(
    account: { vendor: { userId: string }; farmer: { userId: string } },
    requesterId: string,
    requesterRole: string,
  ) {
    if (requesterRole === 'ADMIN') return;
    if (requesterRole === 'VENDOR' && account.vendor.userId === requesterId) return;
    if (requesterRole === 'FARMER' && account.farmer.userId === requesterId) return;
    throw new ForbiddenError('Access denied');
  },
};
