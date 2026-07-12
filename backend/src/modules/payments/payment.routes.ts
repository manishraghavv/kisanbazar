import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  initiatePayment,
  verifyPayment,
  handlePaymentWebhook,
  getPayment,
  processRefund,
  listPayments,
  getWalletBalance,
  addMoneyToWallet,
  getWalletTransactions,
  useWallet,
  createCoupon,
  updateCoupon,
  getCouponById,
  listCoupons,
  validateCoupon,
  deleteCoupon,
  generateSettlement,
  getSettlements,
  listAllSettlements,
  getSettlementById,
  markSettlementPaid,
  getVendorCommissions,
} from './payment.controller';
import {
  initiatePaymentSchema,
  verifyPaymentSchema,
  processRefundSchema,
  listPaymentsQuerySchema,
  addMoneySchema,
  walletPaymentSchema,
  walletTransactionsQuerySchema,
  createCouponSchema,
  updateCouponSchema,
  listCouponsQuerySchema,
  validateCouponSchema,
  generateSettlementSchema,
  paySettlementSchema,
  listSettlementsQuerySchema,
  listCommissionsQuerySchema,
} from './payment.validator';

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
//  WEBHOOKS  (Public — no auth, signature verified in controller)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/payments/webhook/:gateway', asyncHandler((req, res) => handlePaymentWebhook(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  PAYMENTS  (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/payments/initiate', authenticate, validateBody(initiatePaymentSchema), asyncHandler((req, res) => initiatePayment(req as AuthRequest, res)));
router.post('/payments/verify', authenticate, validateBody(verifyPaymentSchema), asyncHandler((req, res) => verifyPayment(req as AuthRequest, res)));
router.get('/payments', authenticate, validateQuery(listPaymentsQuerySchema), asyncHandler((req, res) => listPayments(req as AuthRequest, res)));
router.get('/payments/:id', authenticate, asyncHandler((req, res) => getPayment(req as AuthRequest, res)));
router.post('/payments/:id/refund', authenticate, authorize('ADMIN'), validateBody(processRefundSchema), asyncHandler((req, res) => processRefund(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  WALLET  (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/wallet', authenticate, asyncHandler((req, res) => getWalletBalance(req as AuthRequest, res)));
router.post('/wallet/add-money', authenticate, validateBody(addMoneySchema), asyncHandler((req, res) => addMoneyToWallet(req as AuthRequest, res)));
router.post('/wallet/pay', authenticate, validateBody(walletPaymentSchema), asyncHandler((req, res) => useWallet(req as AuthRequest, res)));
router.get('/wallet/transactions', authenticate, validateQuery(walletTransactionsQuerySchema), asyncHandler((req, res) => getWalletTransactions(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  COUPONS  (Public: GET, validate; Admin: POST, PUT, DELETE)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/coupons', validateQuery(listCouponsQuerySchema), asyncHandler((req, res) => listCoupons(req as AuthRequest, res)));
router.get('/coupons/:id', asyncHandler((req, res) => getCouponById(req as AuthRequest, res)));
router.post('/coupons/validate', validateBody(validateCouponSchema), asyncHandler((req, res) => validateCoupon(req as AuthRequest, res)));

router.post('/coupons', authenticate, authorize('ADMIN'), validateBody(createCouponSchema), asyncHandler((req, res) => createCoupon(req as AuthRequest, res)));
router.put('/coupons/:id', authenticate, authorize('ADMIN'), validateBody(updateCouponSchema), asyncHandler((req, res) => updateCoupon(req as AuthRequest, res)));
router.delete('/coupons/:id', authenticate, authorize('ADMIN'), asyncHandler((req, res) => deleteCoupon(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  VENDOR SETTLEMENTS & COMMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/vendors/me/commissions', authenticate, authorize('VENDOR'), validateQuery(listCommissionsQuerySchema), asyncHandler((req, res) => getVendorCommissions(req as AuthRequest, res)));
router.get('/vendors/:vendorId/settlements', authenticate, authorize('VENDOR', 'ADMIN'), validateQuery(listSettlementsQuerySchema), asyncHandler((req, res) => getSettlements(req as AuthRequest, res)));
router.get('/settlements', authenticate, authorize('ADMIN'), validateQuery(listSettlementsQuerySchema), asyncHandler((req, res) => listAllSettlements(req as AuthRequest, res)));
router.get('/settlements/:id', authenticate, authorize('VENDOR', 'ADMIN'), asyncHandler((req, res) => getSettlementById(req as AuthRequest, res)));

router.post('/settlements/generate', authenticate, authorize('ADMIN'), validateBody(generateSettlementSchema), asyncHandler((req, res) => generateSettlement(req as AuthRequest, res)));
router.post('/settlements/:id/pay', authenticate, authorize('ADMIN'), validateBody(paySettlementSchema), asyncHandler((req, res) => markSettlementPaid(req as AuthRequest, res)));

export default router;
