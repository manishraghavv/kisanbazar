/**
 * Base Repository
 *
 * All domain repositories extend this class to receive the PrismaClient
 * instance via DI. This enables repositories to be mocked in unit tests.
 */

import { PrismaClient } from '@prisma/client';
import { injectable, inject } from 'tsyringe';

// @ts-expect-error Abstract class decorator - tsyringe handles this at runtime
@injectable()
export abstract class BaseRepository {
  constructor(@inject('PrismaClient') protected readonly prisma: PrismaClient) {}
}
