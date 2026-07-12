import { Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../common/errors';

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const NotificationService = {
  async list(
    userId: string,
    filters: { page: number; limit: number; isRead?: boolean; type?: string },
  ) {
    const { page, limit, isRead, type } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (isRead !== undefined) where.isRead = isRead;
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    const unreadCount = isRead === false
      ? total
      : await prisma.notification.count({ where: { userId, isRead: false } });

    return {
      notifications,
      unreadCount,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async markRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundError('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenError('Access denied');

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read' };
  },

  async delete(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundError('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenError('Access denied');

    await prisma.notification.delete({ where: { id: notificationId } });
    return { message: 'Notification deleted' };
  },

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  },

  async create(
    userId: string,
    data: { title: string; message: string; type?: string; deepLink?: string },
  ) {
    return prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        deepLink: data.deepLink,
      },
    });
  },

  async createBulk(
    userIds: string[],
    data: { title: string; message: string; type?: string; deepLink?: string },
  ) {
    const notifications = userIds.map((userId) => ({
      userId,
      title: data.title,
      message: data.message,
      type: data.type,
      deepLink: data.deepLink,
    }));

    await prisma.notification.createMany({ data: notifications });
    return { created: userIds.length };
  },

  async updatePreferences(userId: string, _preferences: Record<string, boolean>) {
    return {
      message: 'Notification preferences storage not yet implemented.',
      preferences: _preferences,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  REVIEW SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const ReviewService = {
  async create(
    userId: string,
    productId: string,
    data: { rating: number; comment?: string; photoUrls?: string[] },
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product) throw new NotFoundError('Product not found');

    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) throw new ConflictError('You have already reviewed this product');

    const purchased = await prisma.orderItem.findFirst({
      where: {
        variant: { productId },
        order: { userId, status: 'DELIVERED' },
      },
    });

    return prisma.review.create({
      data: {
        userId,
        productId,
        rating: data.rating,
        comment: data.comment,
        photoUrls: data.photoUrls || [],
        isVerifiedBuyer: !!purchased,
      },
      include: {
        user: { select: { fullName: true } },
      },
    });
  },

  async update(
    userId: string,
    reviewId: string,
    data: { rating?: number; comment?: string; photoUrls?: string[] },
  ) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError('Review not found');
    if (review.userId !== userId) throw new ForbiddenError('Access denied');

    const updateData: Prisma.ReviewUpdateInput = {};
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.comment !== undefined) updateData.comment = data.comment;
    if (data.photoUrls !== undefined) updateData.photoUrls = data.photoUrls;

    return prisma.review.update({
      where: { id: reviewId },
      data: updateData,
      include: { user: { select: { fullName: true } } },
    });
  },

  async delete(userId: string, reviewId: string, isAdmin: boolean) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError('Review not found');
    if (!isAdmin && review.userId !== userId) throw new ForbiddenError('Access denied');

    await prisma.review.delete({ where: { id: reviewId } });
    return { message: 'Review deleted' };
  },

  async listByProduct(
    productId: string,
    filters: { page: number; limit: number; rating?: number },
  ) {
    const { page, limit, rating } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = { productId };
    if (rating) where.rating = rating;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    const aggregation = await prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      reviews,
      averageRating: Number(aggregation._avg.rating?.toFixed(1) || 0),
      totalReviews: aggregation._count.rating,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async markHelpful(userId: string, reviewId: string) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError('Review not found');

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
      select: { id: true, helpfulCount: true },
    });

    return { message: 'Marked as helpful', reviewId, helpfulCount: updated.helpfulCount };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPPORT TICKET SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

const ticketMessages: Record<string, Array<{
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
}>> = {};

function addMessage(
  ticketId: string,
  senderId: string,
  senderName: string,
  message: string,
  isInternal: boolean = false,
) {
  if (!ticketMessages[ticketId]) {
    ticketMessages[ticketId] = [];
  }
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    ticketId,
    senderId,
    senderName,
    message,
    isInternal,
    createdAt: new Date(),
  };
  ticketMessages[ticketId].push(msg);
  return msg;
}

export const SupportTicketService = {
  async create(
    userId: string,
    data: {
      title: string;
      description: string;
      priority?: string;
      category?: string;
      referenceId?: string;
    },
  ) {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        priority: (data.priority || 'MEDIUM') as any,
        status: 'OPEN',
        category: data.category || null,
        referenceId: data.referenceId || null,
      },
      include: { user: { select: { fullName: true, phoneNumber: true } } },
    });

    addMessage(ticket.id, userId, ticket.user.fullName, data.description, false);
    return ticket;
  },

  async list(
    userId: string,
    filters: { page: number; limit: number; status?: string; priority?: string; category?: string },
  ) {
    const { page, limit, status, priority, category } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = { userId };
    if (status) where.status = status as any;
    if (priority) where.priority = priority as any;
    if (category) where.category = category;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where, skip, take: limit, orderBy: { updatedAt: 'desc' },
        include: { user: { select: { fullName: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    const ticketsWithMeta = tickets.map((t) => ({
      ...t,
      messageCount: (ticketMessages[t.id] || []).length,
    }));

    return { tickets: ticketsWithMeta, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async listAdmin(
    filters: { page: number; limit: number; status?: string; priority?: string; category?: string; userId?: string },
  ) {
    const { page, limit, status, priority, category, userId } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = {};
    if (status) where.status = status as any;
    if (priority) where.priority = priority as any;
    if (category) where.category = category;
    if (userId) where.userId = userId;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where, skip, take: limit, orderBy: { updatedAt: 'desc' },
        include: { user: { select: { fullName: true, phoneNumber: true, email: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    const ticketsWithMeta = tickets.map((t) => ({
      ...t,
      messageCount: (ticketMessages[t.id] || []).length,
    }));

    return { tickets: ticketsWithMeta, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(ticketId: string, userId?: string, isStaff?: boolean) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { fullName: true, phoneNumber: true, email: true } } },
    });
    if (!ticket) throw new NotFoundError('Support ticket not found');
    if (!isStaff && ticket.userId !== userId) throw new ForbiddenError('Access denied');

    const messages = ticketMessages[ticketId] || [];
    return { ...ticket, messages };
  },

  async update(
    ticketId: string,
    actorId: string,
    data: { title?: string; description?: string; priority?: string; status?: string; category?: string; remarks?: string },
    isStaff: boolean,
  ) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { fullName: true } } },
    });
    if (!ticket) throw new NotFoundError('Support ticket not found');
    if (!isStaff && ticket.userId !== actorId) throw new ForbiddenError('Access denied');

    const updateData: Prisma.SupportTicketUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority as any;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.category !== undefined) updateData.category = data.category;

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: { user: { select: { fullName: true } } },
    });

    if (data.status && data.remarks) {
      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
      addMessage(ticketId, actorId, actor?.fullName || 'Staff', data.remarks, true);
    }

    return updated;
  },

  async addMessage(
    ticketId: string,
    senderId: string,
    data: { message: string; isInternal?: boolean },
    isStaff: boolean,
  ) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { fullName: true } } },
    });
    if (!ticket) throw new NotFoundError('Support ticket not found');
    if (!isStaff && ticket.userId !== senderId) throw new ForbiddenError('Access denied');
    if (data.isInternal && !isStaff) throw new ForbiddenError('Only staff can add internal notes');

    const sender = isStaff
      ? await prisma.user.findUnique({ where: { id: senderId }, select: { fullName: true } })
      : ticket.user;
    const senderName = sender?.fullName || 'User';

    const msg = addMessage(ticketId, senderId, senderName, data.message, data.isInternal || false);

    if (isStaff && ticket.status === 'OPEN') {
      await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'IN_PROGRESS' } });
    } else if (!isStaff && (ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_FOR_USER')) {
      await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'WAITING_FOR_USER' } });
    }

    return msg;
  },

  async getMessages(ticketId: string, userId?: string, isStaff?: boolean) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundError('Support ticket not found');
    if (!isStaff && ticket.userId !== userId) throw new ForbiddenError('Access denied');

    const messages = ticketMessages[ticketId] || [];
    if (!isStaff) {
      return { messages: messages.filter((m) => !m.isInternal) };
    }
    return { messages };
  }
};