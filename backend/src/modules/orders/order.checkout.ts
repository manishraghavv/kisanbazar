import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { LEDGER_TX_OPTIONS, postKhataEntry } from '../khata/khata.ledger';
import { debitWallet } from '../payments/wallet.ledger';
import { confirmOrder, orderWalletKey } from '../payments/payment.service';
import { PricedOrder, PricingCoupon, PricingError, PricingLineInput, priceOrder } from './orderPricing';
import { syncOrderStatus } from './orderStatus';

/**
 * Checkout.
 *
 * `createOrder` turns the cart into ONE Order with one SubOrder per vendor, all inside a single interactive
 * transaction, so every guarantee from Phase 2 still holds across vendors:
 *   - the cart is claimed (double-submit fails), stock is taken with a conditional UPDATE (never oversold),
 *   - the coupon's total and per-user limits are enforced under the coupon row lock,
 *   - wallet / khata legs run under row locks and roll everything back if the money is not there,
 *   - delivery charges are computed on the server, per sub-order.
 * Lock order is always: variants (by id) -> coupon -> khata accounts (by id) -> wallet.
 *
 * `quoteOrder` runs the same pricing without writing anything (the checkout page shows it).
 */

export interface CheckoutInput {
  addressId: string;
  paymentMethod: string;
  /** Optional with KHATA_CREDIT: the farmer's khata with ONE vendor; other vendors' accounts are found automatically. */
  khataAccountId?: string | null;
  couponCode?: string;
  channel?: string;
}

type CartWithItems = NonNullable<Awaited<ReturnType<typeof loadCart>>>;

async function loadCart(userId: string) {
  return prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  vendorId: true,
                  gstRate: true,
                  hsnCode: true,
                  vendor: { select: { id: true, businessName: true, commissionRate: true, stateCode: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

async function loadBuyerAddress(userId: string, addressId: string) {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) throw new NotFoundError('Address not found');
  if (!address.stateCode) {
    throw new BadRequestError('Please edit this address and choose its state (needed to calculate GST)');
  }
  return address;
}

function vendorStateMap(cart: CartWithItems): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const item of cart.items) map.set(item.variant.product.vendorId, item.variant.product.vendor.stateCode);
  return map;
}

function toPricingLines(cart: CartWithItems, prices: Map<string, Prisma.Decimal>): PricingLineInput[] {
  return cart.items.map((item) => ({
    variantId: item.variantId,
    productId: item.variant.product.id,
    vendorId: item.variant.product.vendorId,
    quantity: item.quantity,
    unitPrice: prices.get(item.variantId) ?? item.variant.sellingPrice,
    gstRatePct: item.variant.product.gstRate ?? new Prisma.Decimal(0),
    hsnCode: item.variant.product.hsnCode,
    commissionRatePct: item.variant.product.vendor.commissionRate,
  }));
}

function toPricingCoupon(coupon: {
  type: string;
  value: Prisma.Decimal;
  minimumAmount: Prisma.Decimal | null;
  maximumDiscount: Prisma.Decimal | null;
  applicableTo: string;
  vendorId: string | null;
}): PricingCoupon {
  if (coupon.applicableTo === 'VENDOR' && !coupon.vendorId) throw new BadRequestError('Coupon is not valid');
  return {
    type: coupon.type,
    value: coupon.value,
    minimumAmount: coupon.minimumAmount,
    maximumDiscount: coupon.maximumDiscount,
    vendorId: coupon.applicableTo === 'VENDOR' ? coupon.vendorId : null,
  };
}

function assertCouponUsable(coupon: { isActive: boolean; startsAt: Date; expiresAt: Date }): void {
  const now = new Date();
  if (!coupon.isActive || coupon.expiresAt < now || coupon.startsAt > now) {
    throw new BadRequestError('Coupon is not valid');
  }
}

function runPricing(fn: () => PricedOrder): PricedOrder {
  try {
    return fn();
  } catch (err) {
    if (err instanceof PricingError) throw new BadRequestError(err.message);
    throw err;
  }
}

// ── Quote (read-only) ────────────────────────────────────────────────────────

export async function quoteOrder(userId: string, data: { addressId: string; couponCode?: string }) {
  const cart = await loadCart(userId);
  if (!cart || cart.items.length === 0) throw new BadRequestError('Cart is empty');
  const address = await loadBuyerAddress(userId, data.addressId);

  let coupon: PricingCoupon | null = null;
  if (data.couponCode) {
    const found = await prisma.coupon.findUnique({ where: { code: data.couponCode } });
    if (!found) throw new NotFoundError('Coupon not found');
    assertCouponUsable(found);
    coupon = toPricingCoupon(found);
  }

  const priced = runPricing(() =>
    priceOrder({
      lines: toPricingLines(cart, new Map()),
      vendorStateCodes: vendorStateMap(cart),
      placeOfSupply: address.stateCode!,
      coupon,
    }),
  );

  const vendors = new Map(cart.items.map((i) => [i.variant.product.vendorId, i.variant.product.vendor]));
  const names = new Map(cart.items.map((i) => [i.variantId, i.variant]));
  const farmer = await prisma.farmer.findUnique({ where: { userId } });
  const khata = farmer
    ? await prisma.khataAccount.findMany({
        where: { farmerId: farmer.id, vendorId: { in: priced.subOrders.map((s) => s.vendorId) } },
        select: { id: true, vendorId: true, status: true, creditLimitAmount: true, outstandingAmount: true },
      })
    : [];

  return {
    placeOfSupply: address.stateCode,
    couponCode: data.couponCode ?? null,
    subOrders: priced.subOrders.map((so) => {
      const account = khata.find((k) => k.vendorId === so.vendorId);
      return {
        vendorId: so.vendorId,
        vendorName: vendors.get(so.vendorId)?.businessName ?? 'Seller',
        sellerStateCode: so.sellerStateCode,
        interState: so.interState,
        subtotal: so.subtotal,
        discountAmount: so.discountAmount,
        taxableValue: so.taxableValue,
        cgstAmount: so.cgstAmount,
        sgstAmount: so.sgstAmount,
        igstAmount: so.igstAmount,
        gstAmount: so.gstAmount,
        deliveryCharge: so.deliveryCharge,
        totalAmount: so.totalAmount,
        khata: account
          ? {
              accountId: account.id,
              usable: account.status === 'ACTIVE',
              available: account.creditLimitAmount.sub(account.outstandingAmount),
            }
          : null,
        lines: so.lines.map((l) => ({
          variantId: l.variantId,
          name: names.get(l.variantId)?.product.name ?? '',
          variantName: names.get(l.variantId)?.variantName ?? null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          discount: l.discount,
          taxableValue: l.taxableValue,
          gstRate: l.gstRatePct,
          hsnCode: l.hsnCode,
          cgst: l.cgst,
          sgst: l.sgst,
          igst: l.igst,
        })),
      };
    }),
    totals: {
      subtotal: priced.subtotal,
      discountAmount: priced.discountAmount,
      taxableValue: priced.taxableValue,
      cgstAmount: priced.cgstAmount,
      sgstAmount: priced.sgstAmount,
      igstAmount: priced.igstAmount,
      gstAmount: priced.gstAmount,
      deliveryCharge: priced.deliveryCharge,
      totalAmount: priced.totalAmount,
    },
  };
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createOrder(userId: string, data: CheckoutInput) {
  const cart = await loadCart(userId);
  if (!cart || cart.items.length === 0) throw new BadRequestError('Cart is empty');
  const address = await loadBuyerAddress(userId, data.addressId);

  const [{ n: orderSeq }] = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('order_number_seq') AS n`;
  const orderNumber = `KB-${new Date().getFullYear()}-${String(orderSeq).padStart(6, '0')}`;

  return prisma.$transaction(async (tx) => {
    // 0. Claim the cart: a concurrent double-submit blocks here, finds nothing to delete and fails.
    const claimed = await tx.cartItem.deleteMany({ where: { id: { in: cart.items.map((i) => i.id) } } });
    if (claimed.count !== cart.items.length) throw new ConflictError('Cart was changed or already checked out');

    // 1. Take stock atomically (sorted for a stable lock order). The WHERE clause is the guard.
    const prices = new Map<string, Prisma.Decimal>();
    for (const item of [...cart.items].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const taken = await tx.$queryRaw<Array<{ sellingPrice: Prisma.Decimal }>>`
        UPDATE "product_variants"
        SET "stockQuantity" = "stockQuantity" - ${item.quantity}, "updatedAt" = now()
        WHERE "id" = ${item.variantId} AND "stockQuantity" - "reservedQty" >= ${item.quantity}
        RETURNING "sellingPrice"`;
      if (taken.length === 0) throw new BadRequestError(`Insufficient stock for ${item.variant.sku}`);
      prices.set(item.variantId, new Prisma.Decimal(taken[0].sellingPrice));
    }

    // 2. Coupon: validity, then pricing (which validates the minimum and vendor scope), then the claim.
    let pricingCoupon: PricingCoupon | null = null;
    let couponRow: { id: string; perUserLimit: number } | null = null;
    if (data.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: data.couponCode } });
      if (!coupon) throw new NotFoundError('Coupon not found');
      assertCouponUsable(coupon);
      pricingCoupon = toPricingCoupon(coupon);
      couponRow = { id: coupon.id, perUserLimit: coupon.perUserLimit };
    }

    const priced = runPricing(() =>
      priceOrder({
        lines: toPricingLines(cart, prices),
        vendorStateCodes: vendorStateMap(cart),
        placeOfSupply: address.stateCode!,
        coupon: pricingCoupon,
      }),
    );

    let couponSeq = 0;
    if (couponRow) {
      // The conditional UPDATE both enforces the total limit and takes the coupon row lock, so the per-user
      // count below cannot race with another checkout using the same coupon.
      const claimedCoupon = await tx.$executeRaw`
        UPDATE "coupons" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
        WHERE "id" = ${couponRow.id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
      if (claimedCoupon === 0) throw new BadRequestError('Coupon usage limit reached');
      const usedByUser = await tx.couponUsage.count({ where: { couponId: couponRow.id, userId } });
      couponSeq = usedByUser + 1;
      if (couponSeq > couponRow.perUserLimit) throw new BadRequestError('You have already used this coupon');
    }

    // 3. Khata credit: one account per vendor, all belonging to this farmer and ACTIVE.
    const khataByVendor = new Map<string, string>();
    if (data.paymentMethod === 'KHATA_CREDIT') {
      const farmer = await tx.farmer.findUnique({ where: { userId } });
      if (!farmer) throw new BadRequestError('Only farmers can pay on khata credit');
      const accounts = await tx.khataAccount.findMany({
        where: { farmerId: farmer.id, vendorId: { in: priced.subOrders.map((s) => s.vendorId) } },
      });
      if (data.khataAccountId && !accounts.some((a) => a.id === data.khataAccountId)) {
        const own = await tx.khataAccount.findUnique({ where: { id: data.khataAccountId } });
        if (!own || own.farmerId !== farmer.id) throw new NotFoundError('Khata account not found');
        throw new BadRequestError('That khata account is not with a seller in this order');
      }
      for (const so of priced.subOrders) {
        const account = accounts.find((a) => a.vendorId === so.vendorId);
        const name = cart.items.find((i) => i.variant.product.vendorId === so.vendorId)?.variant.product.vendor
          .businessName;
        if (!account) throw new BadRequestError(`You have no khata account with ${name ?? 'one of the sellers'}`);
        if (account.status !== 'ACTIVE')
          throw new BadRequestError(`Your khata with ${name ?? 'a seller'} is not active`);
        khataByVendor.set(so.vendorId, account.id);
      }
    }

    // 4. The order and its sub-orders.
    const singleKhata = new Set(khataByVendor.values()).size === 1 ? [...khataByVendor.values()][0] : null;
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        addressId: data.addressId,
        subtotal: priced.subtotal,
        gstAmount: priced.gstAmount,
        deliveryCharge: priced.deliveryCharge,
        discountAmount: priced.discountAmount,
        totalAmount: priced.totalAmount,
        placeOfSupply: address.stateCode,
        taxableValue: priced.taxableValue,
        cgstAmount: priced.cgstAmount,
        sgstAmount: priced.sgstAmount,
        igstAmount: priced.igstAmount,
        status: 'PENDING',
        paymentMethod: data.paymentMethod as PaymentMethod,
        couponCode: data.couponCode,
        channel: data.channel,
        khataAccountId: singleKhata,
      },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, newStatus: 'PENDING', changedBy: userId, remarks: 'Order placed' },
    });

    const subOrderRows: Array<{ id: string; vendorId: string; subOrderNumber: string; totalAmount: Prisma.Decimal }> =
      [];
    for (const [index, so] of priced.subOrders.entries()) {
      const subOrderNumber = `${orderNumber}-${index + 1}`;
      const row = await tx.subOrder.create({
        data: {
          orderId: order.id,
          vendorId: so.vendorId,
          subOrderNumber,
          status: 'PENDING',
          placeOfSupply: so.placeOfSupply,
          sellerStateCode: so.sellerStateCode,
          isInterState: so.interState,
          subtotal: so.subtotal,
          discountAmount: so.discountAmount,
          taxableValue: so.taxableValue,
          cgstAmount: so.cgstAmount,
          sgstAmount: so.sgstAmount,
          igstAmount: so.igstAmount,
          gstAmount: so.gstAmount,
          deliveryCharge: so.deliveryCharge,
          totalAmount: so.totalAmount,
          khataAccountId: khataByVendor.get(so.vendorId) ?? null,
        },
      });
      subOrderRows.push({ id: row.id, vendorId: so.vendorId, subOrderNumber, totalAmount: so.totalAmount });

      await tx.orderItem.createMany({
        data: so.lines.map((l) => ({
          orderId: order.id,
          subOrderId: row.id,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          gstRate: l.gstRatePct,
          hsnCode: l.hsnCode,
          discountAmount: l.discount,
          taxableValue: l.taxableValue,
          cgstAmount: l.cgst,
          sgstAmount: l.sgst,
          igstAmount: l.igst,
          commissionAmount: l.commissionAmount,
        })),
      });
      await tx.vendorCommission.create({
        data: {
          vendorId: so.vendorId,
          orderId: order.id,
          subOrderId: row.id,
          commissionRate: cart.items.find((i) => i.variant.product.vendorId === so.vendorId)!.variant.product.vendor
            .commissionRate,
          grossAmount: so.taxableValue,
          commissionAmount: so.commissionAmount,
          netAmount: so.taxableValue.sub(so.commissionAmount),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          subOrderId: row.id,
          newStatus: 'PENDING',
          changedBy: userId,
          remarks: 'Order placed',
        },
      });
    }

    if (couponRow) {
      await tx.couponUsage.create({
        data: { couponId: couponRow.id, userId, seq: couponSeq, orderId: order.id },
      });
    }

    // 5. Payment legs, under row locks. Each throws (rolling everything back) if the money is not there.
    if (data.paymentMethod === 'WALLET' && priced.totalAmount.gt(0)) {
      await debitWallet(tx, userId, priced.totalAmount, {
        remarks: `Order ${orderNumber} — held until delivery`,
        referenceId: order.id,
        idempotencyKey: orderWalletKey(orderNumber),
      });
      // The wallet leg IS the payment: record it under the same per-order key /payments/initiate and /wallet/pay use,
      // so no later flow can charge the wallet a second time.
      await tx.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: priced.totalAmount,
          currency: 'INR',
          paymentMethod: 'WALLET',
          gateway: 'wallet',
          status: 'SUCCESS',
          paidAt: new Date(),
          idempotencyKey: orderWalletKey(orderNumber),
        },
      });
      await confirmOrder(tx, order.id, userId, 'Paid via wallet');
    }
    if (data.paymentMethod === 'COD') {
      // Cash is collected at the door; the payment is recorded now (PENDING) so refunds and the COD collection have a row.
      await tx.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: priced.totalAmount,
          currency: 'INR',
          paymentMethod: 'COD',
          gateway: 'cod',
          status: 'PENDING',
          idempotencyKey: `cod:${orderNumber}`,
        },
      });
    }
    if (data.paymentMethod === 'KHATA_CREDIT') {
      for (const row of [...subOrderRows].sort((a, b) =>
        khataByVendor.get(a.vendorId)!.localeCompare(khataByVendor.get(b.vendorId)!),
      )) {
        if (!row.totalAmount.gt(0)) continue;
        await postKhataEntry(tx, {
          accountId: khataByVendor.get(row.vendorId)!,
          type: 'ORDER_LINKED',
          amount: row.totalAmount,
          performedById: userId,
          linkedOrderId: order.id,
          remarks: `Auto-created from order ${row.subOrderNumber}`,
          idempotencyKey: `suborder-khata:${row.subOrderNumber}`,
          allowedStatuses: ['ACTIVE'],
        });
      }
    }

    await syncOrderStatus(tx, order.id, userId);
    return tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, subOrders: { include: { items: true }, orderBy: { subOrderNumber: 'asc' } } },
    });
  }, LEDGER_TX_OPTIONS);
}

export type { OrderStatus };
