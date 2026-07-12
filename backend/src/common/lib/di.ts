/**
 * D.2 — DI Container Composition Root
 *
 * Registers all repositories and services with the tsyringe container.
 * Imported once in src/server.ts before any controllers are loaded.
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { prisma } from './prisma';

// ── Repositories ───────────────────────────────────────────────────────────
import { AuthRepository } from '../../modules/auth/auth.repository';
import { UserRepository } from '../../modules/users/user.repository';
import { KhataRepository } from '../../modules/khata/khata.repository';
import { ProductRepository } from '../../modules/products/product.repository';
import { OrderRepository } from '../../modules/orders/order.repository';
import { PaymentRepository } from '../../modules/payments/payment.repository';
import { EnterpriseRepository } from '../../modules/enterprise/enterprise.repository';

// ── Services ───────────────────────────────────────────────────────────────
import { AuthService } from '../../modules/auth/auth.service';
import { UserService } from '../../modules/users/user.service';
import {
  NotificationService,
  ReviewService,
  SupportTicketService,
} from '../../modules/engagement/engagement.service';
import {
  EnterpriseService,
  AuditLogService,
  AnalyticsService,
} from '../../modules/enterprise/enterprise.service';

// ═══════════════════════════════════════════════════════════════════════════════
//  Register PrismaClient (singleton — same instance everywhere)
// ═══════════════════════════════════════════════════════════════════════════════
container.registerInstance('PrismaClient', prisma);

// ═══════════════════════════════════════════════════════════════════════════════
//  Register Repositories (singletons)
// ═══════════════════════════════════════════════════════════════════════════════
container.registerSingleton(AuthRepository);
container.registerSingleton(UserRepository);
container.registerSingleton(KhataRepository);
container.registerSingleton(ProductRepository);
container.registerSingleton(OrderRepository);
container.registerSingleton(PaymentRepository);
container.registerSingleton(EnterpriseRepository);

// ═══════════════════════════════════════════════════════════════════════════════
//  Register Services (singletons — same instance cached after first resolve)
// ═══════════════════════════════════════════════════════════════════════════════
container.registerSingleton(AuthService);
container.registerSingleton(UserService);
container.registerInstance('NotificationService', NotificationService);
container.registerInstance('ReviewService', ReviewService);
container.registerInstance('SupportTicketService', SupportTicketService);
container.registerInstance('EnterpriseService', EnterpriseService);
container.registerInstance('AuditLogService', AuditLogService);
container.registerInstance('AnalyticsService', AnalyticsService);

export { container };
