/**
 * C.2 — Socket.io WebSocket Server
 *
 * Provides real-time push for:
 * - New notifications (notification:new)
 * - Order status changes (order:status)
 * - Khata transactions (khata:transaction)
 * - Support ticket updates (ticket:update)
 *
 * Users are scoped to their own room (user:<userId>).
 * Admin users also join the admin room for platform-wide events.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { getUserAuthStatus, isAccessAllowed } from './userAuthState';
import { getAllowedOrigins } from '../config/cors';
import { verifyToken, getAccessSecret } from '../utils/jwtUtils';
import { UserRole } from '@prisma/client';

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: getAllowedOrigins(), methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // ── Authentication Middleware ──────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Allow unauthenticated connections but restrict their access
      (socket as any).user = null;
      return next();
    }

    const payload = verifyToken(token as string, getAccessSecret());
    if (!payload) {
      return next(new Error('Invalid token'));
    }

    try {
      if (!isAccessAllowed(await getUserAuthStatus(payload.userId))) return next(new Error('Account is not active'));
    } catch {
      return next(new Error('Authentication unavailable'));
    }

    (socket as any).user = { id: payload.userId, role: payload.role as UserRole };
    next();
  });

  // ── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = (socket as any).user;
    const userId = user?.id || `anon_${socket.id}`;

    console.log(`[WS] User ${userId} connected (socket ${socket.id})`);

    // Join user's personal room
    if (user?.id) {
      socket.join(`user:${user.id}`);
    }

    // Admin users also join the admin broadcast room
    if (user?.role === 'ADMIN') {
      socket.join('admin');
      console.log(`[WS] Admin ${user.id} joined admin room`);
    }

    // Join order tracking room (client can request to follow specific orders)
    socket.on('order:track', (orderId: string) => {
      if (user?.id) {
        socket.join(`order:${orderId}`);
        console.log(`[WS] User ${user.id} tracking order ${orderId}`);
      }
    });

    socket.on('order:untrack', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    // Join khata account room
    socket.on('khata:track', (accountId: string) => {
      if (user?.id) {
        socket.join(`khata:${accountId}`);
        console.log(`[WS] User ${user.id} tracking khata ${accountId}`);
      }
    });

    socket.on('khata:untrack', (accountId: string) => {
      socket.leave(`khata:${accountId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] User ${userId} disconnected`);
    });
  });

  console.log('[WS] Socket.io initialized');
  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Event Emitters
// ═══════════════════════════════════════════════════════════════════════════════

export const socketEmitter = {
  /**
   * Emit a new notification to a specific user
   */
  notification(userId: string, notification: { id: string; title: string; message: string; type?: string; createdAt: Date }) {
    io?.to(`user:${userId}`).emit('notification:new', notification);
  },

  /**
   * Emit order status change to the order owner and relevant parties
   */
  orderStatus(orderId: string, data: { orderId: string; oldStatus: string; newStatus: string; orderNumber: string }) {
    io?.to(`order:${orderId}`).emit('order:status', data);
    // Also broadcast to admin room
    io?.to('admin').emit('order:status', data);
  },

  /**
   * Emit khata transaction to involved parties
   */
  khataTransaction(accountId: string, data: { accountId: string; type: string; amount: number; newBalance: number }) {
    io?.to(`khata:${accountId}`).emit('khata:transaction', data);
  },

  /**
   * Emit support ticket update
   */
  ticketUpdate(userId: string, ticketId: string, data: { ticketId: string; status: string; priority?: string }) {
    io?.to(`user:${userId}`).emit('ticket:update', data);
    io?.to('admin').emit('ticket:update', data);
  },

  /**
   * Broadcast to all admin users
   */
  adminBroadcast(event: string, data: unknown) {
    io?.to('admin').emit(event, data);
  },
};
