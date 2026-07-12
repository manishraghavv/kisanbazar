import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  triggerInterestCalculation,
  triggerOverdueEscalation,
  triggerCartCleanup,
  triggerRepaymentReminders,
  triggerPriceAlerts,
  getCronStatusController,
} from './cron.controller';
import {
  downloadInvoice,
  getInvoiceData,
  downloadBulkInvoices,
} from '../orders/invoice.controller';
import { CouponService } from '../payments/payment.service';
import {
  validateCouponSchema,
} from '../payments/payment.validator';

const router = Router();

function validateBody(schema: Joi.ObjectSchema) {
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

// ── Bull Board (Lazily Initialized) ──────────────────────────────────────────
// Bull Board provides a UI dashboard for monitoring queues at /admin/queues.
// It is initialized AFTER queues are ready to avoid a race condition.
// Call initBullBoard() from index.ts after initQueues().
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

let bullBoardRouter: Router | null = null;

// Wrapper middleware — delegates to Bull Board only once initialized
router.use('/queues', (req: Request, res: Response, next: NextFunction) => {
  if (bullBoardRouter) {
    return bullBoardRouter(req, res, next);
  }
  // Bull Board not initialized (Redis unavailable) — pass to next handler
  next();
});

export async function initBullBoard(): Promise<void> {
  try {
    const { queues: q } = await import('../../jobs/queues');
    const qMap: Record<string, unknown> = q || {};
    const entries = Object.entries(qMap).filter(([, val]) => val !== null);

    if (entries.length === 0) {
      console.log('[BULL-BOARD] No BullMQ queues available — dashboard disabled');
      return;
    }

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/api/admin/queues');
    const bullQueues = entries.map(([, queue]) => new BullMQAdapter(queue as Queue));

    createBullBoard({ queues: bullQueues, serverAdapter });
    bullBoardRouter = serverAdapter.getRouter();
    console.log(`[BULL-BOARD] Dashboard initialized with ${bullQueues.length} queues`);
  } catch (err) {
    console.warn('[BULL-BOARD] Failed to initialize:', (err as Error).message);
  }
}

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize('ADMIN'));

// ═══════════════════════════════════════════════════════════════════════════════
//  CRON TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/admin/crons/interest', asyncHandler((req, res) => triggerInterestCalculation(req as AuthRequest, res)));
router.post('/admin/crons/overdue', asyncHandler((req, res) => triggerOverdueEscalation(req as AuthRequest, res)));
router.post('/admin/crons/reminders', asyncHandler((req, res) => triggerRepaymentReminders(req as AuthRequest, res)));
router.post('/admin/crons/clear-carts', asyncHandler((req, res) => triggerCartCleanup(req as AuthRequest, res)));
router.post('/admin/crons/price-alerts', asyncHandler((req, res) => triggerPriceAlerts(req as AuthRequest, res)));
router.get('/admin/crons/status', asyncHandler((req, res) => getCronStatusController(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  INVOICE ENDPOINTS (Authenticated users - own orders, or admin/vendor)
// ═══════════════════════════════════════════════════════════════════════════════

export { router as adminRouter };

// Export invoice routes for mounting on main app (non-admin users also need access)
export const invoiceRouter = Router();

invoiceRouter.get('/orders/:id/invoice', authenticate, asyncHandler((req, res) => downloadInvoice(req as AuthRequest, res)));
invoiceRouter.get('/orders/:id/invoice-data', authenticate, asyncHandler((req, res) => getInvoiceData(req as AuthRequest, res)));
invoiceRouter.post('/orders/bulk-invoices', authenticate, authorize('ADMIN'), asyncHandler((req, res) => downloadBulkInvoices(req as AuthRequest, res)));

// ═══════════════════════════════════════════════════════════════════════════════
//  B.8 — AUTO-APPLY COUPON
// ═══════════════════════════════════════════════════════════════════════════════

export const autoApplyCouponHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await CouponService.autoApply(req.body.subtotal, {
      categoryId: req.body.categoryId,
      vendorId: req.body.vendorId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    const e = err as { status?: number; statusCode?: number; message?: string };
    res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
  }
};
