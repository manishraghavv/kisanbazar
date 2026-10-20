import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { PaymentService, WalletService, CouponService, SettlementService } from './payment.service';
const paymentService = PaymentService;
const walletService = WalletService;
const couponService = CouponService;
const settlementService = SettlementService;

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const initiatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await paymentService.initiate(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Payment initiated', data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await paymentService.verify(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await paymentService.getPayment(req.params.id as string);
    res.json({ success: true, data: payment });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const processRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await paymentService.processRefund(req.params.id as string, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await paymentService.listPayments({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
      orderId: req.query.orderId as string | undefined,
    });
    res.json({
      success: true,
      data: result.payments,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  WALLET
// ═══════════════════════════════════════════════════════════════════════════════

export const getWalletBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await walletService.getBalance(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const addMoneyToWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallet = await walletService.addMoney(req.user.id, req.body.amount, req.body.remarks);
    res.json({ success: true, message: 'Money added to wallet', data: wallet });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getWalletTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await walletService.getTransactions(req.user.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      type: req.query.type as string | undefined,
    });
    res.json({
      success: true,
      data: result.transactions,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const useWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await walletService.useForPayment(req.user.id, req.body.orderId, req.body.amount);
    res.json({ success: true, message: 'Wallet payment completed', data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  COUPONS
// ═══════════════════════════════════════════════════════════════════════════════

export const createCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coupon = await couponService.create({
      ...req.body,
      startsAt: new Date(req.body.startsAt),
      expiresAt: new Date(req.body.expiresAt),
    });
    res.status(201).json({ success: true, message: 'Coupon created', data: coupon });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coupon = await couponService.update(req.params.id as string, {
      ...req.body,
      ...(req.body.startsAt && { startsAt: new Date(req.body.startsAt) }),
      ...(req.body.expiresAt && { expiresAt: new Date(req.body.expiresAt) }),
    });
    res.json({ success: true, message: 'Coupon updated', data: coupon });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getCouponById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coupon = await couponService.getById(req.params.id as string);
    res.json({ success: true, data: coupon });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listCoupons = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await couponService.list({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      type: req.query.type as string | undefined,
    });
    res.json({
      success: true,
      data: result.coupons,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const validateCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await couponService.validate(req.body.code, req.body.subtotal, {
      categoryId: req.body.categoryId,
      vendorId: req.body.vendorId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await couponService.delete(req.params.id as string);
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  VENDOR SETTLEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const generateSettlement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settlement = await settlementService.generate(
      req.body.vendorId,
      new Date(req.body.periodStart),
      new Date(req.body.periodEnd),
    );
    res.status(201).json({ success: true, message: 'Settlement generated', data: settlement });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listAllSettlements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await settlementService.listAll({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
    });
    res.json({
      success: true,
      data: result.settlements,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getSettlements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vendorId = req.params.vendorId as string;
    const result = await settlementService.list(vendorId, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
    });
    res.json({
      success: true,
      data: result.settlements,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getSettlementById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settlement = await settlementService.getById(req.params.id as string);
    res.json({ success: true, data: settlement });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const markSettlementPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settlement = await settlementService.markPaid(req.params.id as string, req.body.utrNumber);
    res.json({ success: true, message: 'Settlement marked as paid', data: settlement });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getVendorCommissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await settlementService.getCommissions(req.user.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      orderId: req.query.orderId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({
      success: true,
      data: result.commissions,
      summary: result.summary,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};
