import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import {
  NotificationService,
  ReviewService,
  SupportTicketService,
} from './engagement.service';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const listNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await NotificationService.list(req.user.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      type: req.query.type as string | undefined,
    });
    res.json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await NotificationService.markRead(req.user.id, req.params.id as string);
    res.json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await NotificationService.markAllRead(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await NotificationService.delete(req.user.id, req.params.id as string);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getUnreadNotificationCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await NotificationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await NotificationService.updatePreferences(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await ReviewService.create(req.user.id, req.params.productId as string, req.body);
    res.status(201).json({ success: true, message: 'Review submitted', data: review });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await ReviewService.update(req.user.id, req.params.id as string, req.body);
    res.json({ success: true, message: 'Review updated', data: review });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ReviewService.delete(req.user.id, req.params.id as string, req.user.role === 'ADMIN');
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listProductReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ReviewService.listByProduct(req.params.productId as string, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      rating: req.query.rating ? Number(req.query.rating) : undefined,
    });
    res.json({
      success: true,
      data: result.reviews,
      averageRating: result.averageRating,
      totalReviews: result.totalReviews,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const markReviewHelpful = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ReviewService.markHelpful(req.user.id, req.params.id as string);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPPORT TICKETS
// ═══════════════════════════════════════════════════════════════════════════════

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicketService.create(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Support ticket created', data: ticket });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listMyTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await SupportTicketService.list(req.user.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      category: req.query.category as string | undefined,
    });
    res.json({
      success: true,
      data: result.tickets,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listAllTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await SupportTicketService.listAdmin({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      category: req.query.category as string | undefined,
      userId: req.query.userId as string | undefined,
    });
    res.json({
      success: true,
      data: result.tickets,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getTicketById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isStaff = req.user.role === 'ADMIN' || req.user.role === 'VENDOR';
    const ticket = await SupportTicketService.getById(
      req.params.id as string,
      req.user.id,
      isStaff,
    );
    res.json({ success: true, data: ticket });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isStaff = req.user.role === 'ADMIN' || req.user.role === 'VENDOR';
    const ticket = await SupportTicketService.update(
      req.params.id as string,
      req.user.id,
      req.body,
      isStaff,
    );
    res.json({ success: true, message: 'Ticket updated', data: ticket });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const addTicketMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isStaff = req.user.role === 'ADMIN' || req.user.role === 'VENDOR';
    const msg = await SupportTicketService.addMessage(
      req.params.id as string,
      req.user.id,
      req.body,
      isStaff,
    );
    res.status(201).json({ success: true, message: 'Message added', data: msg });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getTicketMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isStaff = req.user.role === 'ADMIN' || req.user.role === 'VENDOR';
    const result = await SupportTicketService.getMessages(
      req.params.id as string,
      req.user.id,
      isStaff,
    );
    res.json({ success: true, data: result.messages });
  } catch (err) {
    handleServiceError(err, res);
  }
};
