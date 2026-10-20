import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getUnreadNotificationCount,
  updateNotificationPreferences,
  createReview,
  updateReview,
  deleteReview,
  listProductReviews,
  markReviewHelpful,
  createTicket,
  listMyTickets,
  listAllTickets,
  getTicketById,
  updateTicket,
  addTicketMessage,
  getTicketMessages,
} from './engagement.controller';
import {
  listNotificationsQuerySchema,
  notificationPreferencesSchema,
  createReviewSchema,
  updateReviewSchema,
  listReviewsQuerySchema,
  createTicketSchema,
  updateTicketSchema,
  addTicketMessageSchema,
  listTicketsQuerySchema,
  listTicketsAdminQuerySchema,
} from './engagement.validator';

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
//  NOTIFICATIONS  (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/notifications',
  authenticate,
  validateQuery(listNotificationsQuerySchema),
  asyncHandler((req, res) => listNotifications(req as AuthRequest, res)),
);
router.put(
  '/notifications/read-all',
  authenticate,
  asyncHandler((req, res) => markAllNotificationsRead(req as AuthRequest, res)),
);
router.get(
  '/notifications/unread-count',
  authenticate,
  asyncHandler((req, res) => getUnreadNotificationCount(req as AuthRequest, res)),
);
router.put(
  '/notifications/:id/read',
  authenticate,
  asyncHandler((req, res) => markNotificationRead(req as AuthRequest, res)),
);
router.delete(
  '/notifications/:id',
  authenticate,
  asyncHandler((req, res) => deleteNotification(req as AuthRequest, res)),
);
router.post(
  '/notifications/preferences',
  authenticate,
  validateBody(notificationPreferencesSchema),
  asyncHandler((req, res) => updateNotificationPreferences(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  REVIEWS  (Public: GET product reviews; Authenticated: POST, PUT, DELETE)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/products/:productId/reviews',
  validateQuery(listReviewsQuerySchema),
  asyncHandler((req, res) => listProductReviews(req as AuthRequest, res)),
);
router.post(
  '/products/:productId/reviews',
  authenticate,
  validateBody(createReviewSchema),
  asyncHandler((req, res) => createReview(req as AuthRequest, res)),
);
router.put(
  '/reviews/:id',
  authenticate,
  validateBody(updateReviewSchema),
  asyncHandler((req, res) => updateReview(req as AuthRequest, res)),
);
router.delete(
  '/reviews/:id',
  authenticate,
  asyncHandler((req, res) => deleteReview(req as AuthRequest, res)),
);
router.post(
  '/reviews/:id/helpful',
  authenticate,
  asyncHandler((req, res) => markReviewHelpful(req as AuthRequest, res)),
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPPORT TICKETS  (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════════

// User endpoints
router.post(
  '/support/tickets',
  authenticate,
  validateBody(createTicketSchema),
  asyncHandler((req, res) => createTicket(req as AuthRequest, res)),
);
router.get(
  '/support/tickets',
  authenticate,
  validateQuery(listTicketsQuerySchema),
  asyncHandler((req, res) => listMyTickets(req as AuthRequest, res)),
);

// All tickets — Admin/Vendor endpoint (must be before :id to avoid conflict)
router.get(
  '/support/tickets/all',
  authenticate,
  authorize('ADMIN', 'VENDOR'),
  validateQuery(listTicketsAdminQuerySchema),
  asyncHandler((req, res) => listAllTickets(req as AuthRequest, res)),
);

router.get(
  '/support/tickets/:id',
  authenticate,
  asyncHandler((req, res) => getTicketById(req as AuthRequest, res)),
);
router.put(
  '/support/tickets/:id',
  authenticate,
  validateBody(updateTicketSchema),
  asyncHandler((req, res) => updateTicket(req as AuthRequest, res)),
);
router.post(
  '/support/tickets/:id/messages',
  authenticate,
  validateBody(addTicketMessageSchema),
  asyncHandler((req, res) => addTicketMessage(req as AuthRequest, res)),
);
router.get(
  '/support/tickets/:id/messages',
  authenticate,
  asyncHandler((req, res) => getTicketMessages(req as AuthRequest, res)),
);

export default router;
