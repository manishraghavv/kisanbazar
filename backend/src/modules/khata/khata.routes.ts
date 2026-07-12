import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  addTransaction,
  getTransactions,
  getRequests,
  createRequest,
  reviewRequest,
  getStatements,
  getStatementById,
  generateStatement,
  getAdminKhataOverview,
  getVendorAnalytics,
  getOverdueAccounts,
  getOverdueTrends,
  generateStatementPdf,
} from './khata.controller';
import {
  createKhataAccountSchema,
  updateKhataAccountSchema,
  addTransactionSchema,
  createKhataRequestSchema,
  reviewKhataRequestSchema,
  generateStatementSchema,
  getAccountsQuerySchema,
  getTransactionsQuerySchema,
  getOverdueAccountsQuerySchema,
} from './khata.validator';

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

// All khata routes require authentication
router.use(authenticate);

// ── Analytics / Dashboard routes (BEFORE :id routes) ────────────────────────

router.get(
  '/admin/overview',
  authorize('ADMIN'),
  asyncHandler((req, res) => getAdminKhataOverview(req as AuthRequest, res)),
);

router.get(
  '/analytics',
  authorize('VENDOR', 'ADMIN'),
  asyncHandler((req, res) => getVendorAnalytics(req as AuthRequest, res)),
);

router.get(
  '/accounts/overdue',
  authorize('VENDOR', 'ADMIN'),
  validateQuery(getOverdueAccountsQuerySchema),
  asyncHandler((req, res) => getOverdueAccounts(req as AuthRequest, res)),
);

router.get(
  '/trends/overdue',
  authorize('VENDOR', 'ADMIN'),
  asyncHandler((req, res) => getOverdueTrends(req as AuthRequest, res)),
);

// ── Accounts ────────────────────────────────────────────────────────────────

router.post(
  '/accounts',
  authorize('VENDOR'),
  validateBody(createKhataAccountSchema),
  asyncHandler((req, res) => createAccount(req as AuthRequest, res)),
);

router.get(
  '/accounts',
  authorize('VENDOR', 'FARMER', 'ADMIN'),
  validateQuery(getAccountsQuerySchema),
  asyncHandler((req, res) => getAccounts(req as AuthRequest, res)),
);

router.get(
  '/accounts/:id',
  authorize('VENDOR', 'FARMER', 'ADMIN'),
  asyncHandler((req, res) => getAccountById(req as AuthRequest, res)),
);

router.put(
  '/accounts/:id',
  authorize('VENDOR', 'ADMIN'),
  validateBody(updateKhataAccountSchema),
  asyncHandler((req, res) => updateAccount(req as AuthRequest, res)),
);

// ── Transactions ─────────────────────────────────────────────────────────────

router.post(
  '/accounts/:id/transactions',
  authorize('VENDOR', 'ADMIN'),
  validateBody(addTransactionSchema),
  asyncHandler((req, res) => addTransaction(req as AuthRequest, res)),
);

router.get(
  '/accounts/:id/transactions',
  authorize('VENDOR', 'FARMER', 'ADMIN'),
  validateQuery(getTransactionsQuerySchema),
  asyncHandler((req, res) => getTransactions(req as AuthRequest, res)),
);

// ── Credit Requests ──────────────────────────────────────────────────────────

router.get(
  '/accounts/:id/requests',
  authorize('VENDOR', 'FARMER', 'ADMIN'),
  asyncHandler((req, res) => getRequests(req as AuthRequest, res)),
);

router.post(
  '/accounts/:id/requests',
  authorize('FARMER'),
  validateBody(createKhataRequestSchema),
  asyncHandler((req, res) => createRequest(req as AuthRequest, res)),
);

router.put(
  '/requests/:requestId',
  authorize('VENDOR', 'ADMIN'),
  validateBody(reviewKhataRequestSchema),
  asyncHandler((req, res) => reviewRequest(req as AuthRequest, res)),
);

// ── Statements ───────────────────────────────────────────────────────────────

router.get(
  '/accounts/:id/statements',
  authorize('VENDOR', 'FARMER', 'ADMIN'),
  asyncHandler((req, res) => getStatements(req as AuthRequest, res)),
);

router.get(
  '/accounts/:id/statements/:statementId',
  authorize('VENDOR', 'FARMER', 'ADMIN'),
  asyncHandler((req, res) => getStatementById(req as AuthRequest, res)),
);

router.post(
  '/accounts/:id/statement/generate',
  authorize('VENDOR', 'ADMIN'),
  validateBody(generateStatementSchema),
  asyncHandler((req, res) => generateStatement(req as AuthRequest, res)),
);

router.get(
  '/accounts/:id/statement/pdf',
  authorize('VENDOR', 'FARMER', 'ADMIN'),
  asyncHandler((req, res) => generateStatementPdf(req as AuthRequest, res)),
);

export default router;
