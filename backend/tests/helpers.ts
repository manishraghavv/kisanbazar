import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/server';
import { prisma } from '../src/common/lib/prisma';
import { hashPassword } from '../src/common/utils/passwordUtils';

export { app, prisma };
export const api = () => request(app);

let phoneSeq = Math.floor(Math.random() * 1_000_000);
/** Unique valid Indian mobile number (starts 6-9, 10 digits). */
export function uniquePhone(): string {
  phoneSeq += 1;
  return `9${String(phoneSeq % 1_000_000_000).padStart(9, '0')}`;
}

export interface TestUser {
  id: string;
  phoneNumber: string;
  password: string;
  accessToken: string;
}

export const bearer = (user: Pick<TestUser, 'accessToken'>) => ({ Authorization: `Bearer ${user.accessToken}` });

/** Registers through the public API (FARMER or VENDOR), then logs in. */
export async function registerAndLogin(role: 'FARMER' | 'VENDOR' = 'FARMER'): Promise<TestUser> {
  const phoneNumber = uniquePhone();
  const password = 'Test@12345';
  const reg = await api()
    .post('/api/auth/register')
    .send({ fullName: `Test ${role}`, phoneNumber, password, role });
  if (reg.status >= 300) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const login = await api().post('/api/auth/login').send({ phoneNumber, password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  return { id: login.body.data.user.id, phoneNumber, password, accessToken: login.body.data.accessToken };
}

/** Creates an admin directly in the DB (self-registration as ADMIN is not allowed) and logs in. */
export async function createAdminAndLogin(): Promise<TestUser> {
  const phoneNumber = uniquePhone();
  const password = 'Test@12345';
  const user = await prisma.user.create({
    data: {
      fullName: 'Test Admin',
      phoneNumber,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      isPhoneVerified: true,
    },
  });
  const login = await api().post('/api/auth/login').send({ phoneNumber, password });
  return { id: user.id, phoneNumber, password, accessToken: login.body.data.accessToken };
}

/** Creates a vendor + category + product + variant straight in the DB. */
export async function createCatalogItem(opts: { stock?: number; price?: number } = {}) {
  const vendorUser = await registerAndLogin('VENDOR');
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { userId: vendorUser.id } });
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.category.create({ data: { name: `Cat ${suffix}`, slug: `cat-${suffix}` } });
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      categoryId: category.id,
      name: `Product ${suffix}`,
      slug: `product-${suffix}`,
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
      gstRate: 5,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `SKU-${suffix}`,
      mrp: (opts.price ?? 100) + 10,
      sellingPrice: opts.price ?? 100,
      stockQuantity: opts.stock ?? 50,
    },
  });
  return { vendorUser, vendor, category, product, variant };
}

// ── Direct-to-DB fixtures (fast: no HTTP, no bcrypt) for concurrency tests ───────────────────────────

/** A farmer with a farmer profile, an address and a wallet. */
export async function createFarmerDirect(opts: { walletBalance?: number } = {}) {
  const user = await prisma.user.create({
    data: { fullName: 'Direct Farmer', phoneNumber: uniquePhone(), role: 'FARMER', isPhoneVerified: true },
  });
  const farmer = await prisma.farmer.create({ data: { userId: user.id } });
  const address = await prisma.address.create({
    data: { userId: user.id, addressLine1: '1 Test Road', city: 'Meerut', state: 'Uttar Pradesh', pincode: '250001' },
  });
  await prisma.wallet.create({ data: { userId: user.id, balance: opts.walletBalance ?? 0 } });
  return { user, farmer, address };
}

/** Replaces the user's cart with the given lines. */
export async function fillCart(userId: string, lines: Array<{ variantId: string; quantity: number }>) {
  const cart = await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.createMany({ data: lines.map((l) => ({ cartId: cart.id, ...l })) });
  return cart;
}

export async function createKhataAccount(vendorId: string, farmerId: string, creditLimit: number) {
  return prisma.khataAccount.create({
    data: { vendorId, farmerId, creditLimitAmount: creditLimit, interestRatePct: 12, creditPeriodDays: 30 },
  });
}
