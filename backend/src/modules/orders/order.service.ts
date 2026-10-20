import { Prisma, OrderStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import { ForbiddenError, NotFoundError, ConflictError, BadRequestError } from '../../common/errors';
import PDFDocument from 'pdfkit';

async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `KB-${year}-`;
  const lastOrder = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  let nextSeq = 1;
  if (lastOrder) {
    const num = parseInt(lastOrder.orderNumber.split('-')[2] || '0', 10);
    nextSeq = num + 1;
  }
  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

export const InvoiceService = {
  async generateInvoice(orderId: string, userId: string, requesterRole: string): Promise<PDFKit.PDFDocument> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { fullName: true, phoneNumber: true, email: true } },
        address: true,
        items: {
          include: {
            variant: {
              select: {
                sku: true,
                variantName: true,
                mrp: true,
                sellingPrice: true,
                product: {
                  select: {
                    name: true,
                    hsnCode: true,
                    gstRate: true,
                    vendor: { select: { businessName: true, gstNumber: true, panNumber: true } },
                  },
                },
              },
            },
          },
        },
        payments: { where: { status: 'SUCCESS' }, take: 1 },
      },
    });
    if (!order) throw new NotFoundError('Order not found');
    if (requesterRole !== 'ADMIN' && order.userId !== userId) {
      const vendor = await prisma.vendor.findUnique({ where: { userId } });
      if (!vendor) throw new ForbiddenError('Access denied');
      const hasItem = order.items.some((i) => i.variant.product.vendor.businessName);
      if (!hasItem) throw new ForbiddenError('Access denied');
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.fontSize(18).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text(`Invoice #: ${order.orderNumber}`, { align: 'center' })
      .text(`Date: ${order.createdAt.toLocaleDateString('en-IN')}`, { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);

    const vendor = order.items[0]?.variant.product.vendor;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Seller:', 50);
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    doc.text(`  ${vendor?.businessName || 'Vendor'}`, 50);
    if (vendor?.gstNumber) doc.text(`  GST: ${vendor.gstNumber}`, 50);
    if (vendor?.panNumber) doc.text(`  PAN: ${vendor.panNumber}`, 50);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Buyer:', 310);
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    doc.text(`  ${order.user.fullName}`, 310);
    doc.text(`  Phone: ${order.user.phoneNumber}`, 310);
    doc.text(`  ${order.address.addressLine1}, ${order.address.city}`, 310);
    doc.text(`  ${order.address.state} - ${order.address.pincode}`, 310);
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);

    let rowY = doc.y + 10;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff');
    doc.rect(50, rowY - 4, 495, 16).fill('#2D6A4F');
    doc.fillColor('#fff');
    doc.text('HSN/SAC', 50, rowY, { width: 55 });
    doc.text('Description', 110, rowY, { width: 165 });
    doc.text('Qty', 280, rowY, { width: 45, align: 'center' });
    doc.text('Rate', 330, rowY, { width: 55, align: 'right' });
    doc.text('Taxable', 390, rowY, { width: 55, align: 'right' });
    doc.text('GST%', 450, rowY, { width: 50, align: 'center' });
    doc.text('Amount', 505, rowY, { width: 40, align: 'right' });
    doc.moveDown(0.5);

    rowY = doc.y;
    for (const [i, item] of order.items.entries()) {
      const bgColor = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
      doc.rect(50, rowY - 2, 495, 18).fill(bgColor);
      const rate = Number(item.unitPrice);
      const taxable = rate * item.quantity;
      const gstRate = Number(item.gstRate);
      const gstAmount = (taxable * gstRate) / 100;
      const lineTotal = taxable + gstAmount;
      doc.fontSize(7.5).font('Helvetica').fillColor('#333');
      doc.text(item.variant.product.hsnCode || '-', 50, rowY, { width: 55 });
      doc.text(item.variant.product.name.slice(0, 30), 110, rowY, { width: 165 });
      doc.text(String(item.quantity), 280, rowY, { width: 45, align: 'center' });
      doc.text(`₹${rate}`, 330, rowY, { width: 55, align: 'right' });
      doc.text(`₹${taxable}`, 390, rowY, { width: 55, align: 'right' });
      doc.text(`${gstRate}%`, 450, rowY, { width: 50, align: 'center' });
      doc.text(`₹${lineTotal}`, 505, rowY, { width: 40, align: 'right' });
      rowY += 18;
    }

    doc.moveDown(1);
    const totalsY = doc.y + 5;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
    doc.text('Subtotal:', 380, totalsY, { width: 80, align: 'right' });
    doc.text(`₹${Number(order.subtotal)}`, 465, totalsY, { width: 80, align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    doc.text('GST:', 380, totalsY + 15, { width: 80, align: 'right' });
    doc.text(`₹${Number(order.gstAmount)}`, 465, totalsY + 15, { width: 80, align: 'right' });
    if (Number(order.deliveryCharge) > 0) {
      doc.text('Delivery:', 380, totalsY + 30, { width: 80, align: 'right' });
      doc.text(`₹${Number(order.deliveryCharge)}`, 465, totalsY + 30, { width: 80, align: 'right' });
    }
    if (Number(order.discountAmount) > 0) {
      doc.text('Discount:', 380, totalsY + 45, { width: 80, align: 'right' });
      doc.text(`-₹${Number(order.discountAmount)}`, 465, totalsY + 45, { width: 80, align: 'right' });
    }
    doc
      .moveTo(370, totalsY + 58)
      .lineTo(545, totalsY + 58)
      .strokeColor('#ccc')
      .stroke();
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
    doc.text('Total:', 380, totalsY + 63, { width: 80, align: 'right' });
    doc.text(`₹${Number(order.totalAmount)}`, 465, totalsY + 63, { width: 80, align: 'right' });
    doc.end();
    return doc;
  },

  async getInvoiceData(orderId: string, userId: string, requesterRole: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, fullName: true } },
        items: {
          include: {
            variant: {
              select: {
                variantName: true,
                sellingPrice: true,
                product: {
                  select: {
                    name: true,
                    hsnCode: true,
                    gstRate: true,
                    vendor: { select: { businessName: true, gstNumber: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundError('Order not found');
    if (requesterRole !== 'ADMIN' && order.user.id !== userId) {
      const vendor = await prisma.vendor.findUnique({ where: { userId } });
      if (!vendor) throw new ForbiddenError('Access denied');
      const hasItem = order.items.some((i) => i.variant.product.vendor.businessName);
      if (!hasItem) throw new ForbiddenError('Access denied');
    }
    const vendor = order.items[0]?.variant.product.vendor;
    return {
      orderNumber: order.orderNumber,
      vendorName: vendor?.businessName || 'Vendor',
      vendorGst: vendor?.gstNumber || null,
      buyerName: order.user.fullName,
      items: order.items.map((i) => ({
        name: i.variant.product.name,
        hsn: i.variant.product.hsnCode || '',
        qty: i.quantity,
        rate: Number(i.unitPrice),
        gst: Number(i.gstRate),
      })),
      subtotal: Number(order.subtotal),
      gst: Number(order.gstAmount),
      total: Number(order.totalAmount),
    };
  },
};

export const CartService = {
  async getCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                variantName: true,
                mrp: true,
                sellingPrice: true,
                stockQuantity: true,
                reservedQty: true,
                weightGrams: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  variantName: true,
                  mrp: true,
                  sellingPrice: true,
                  stockQuantity: true,
                  reservedQty: true,
                },
              },
            },
          },
        },
      });
    }
    return cart;
  },

  async addItem(userId: string, variantId: string, quantity: number) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundError('Variant not found');
    const available = variant.stockQuantity - variant.reservedQty;
    if (available < quantity)
      throw new BadRequestError(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }
    const existingItem = await prisma.cartItem.findFirst({ where: { cartId: cart.id, variantId } });
    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > 99) throw new BadRequestError('Cart item quantity cannot exceed 99');
      if (available < newQty)
        throw new BadRequestError(`Insufficient stock. Available: ${available}, Requested: ${newQty}`);
      await prisma.productVariant.update({ where: { id: variantId }, data: { reservedQty: { increment: quantity } } });
      return prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              variantName: true,
              mrp: true,
              sellingPrice: true,
              stockQuantity: true,
              reservedQty: true,
            },
          },
        },
      });
    }
    await prisma.productVariant.update({ where: { id: variantId }, data: { reservedQty: { increment: quantity } } });
    return prisma.cartItem.create({
      data: { cartId: cart.id, variantId, quantity },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            variantName: true,
            mrp: true,
            sellingPrice: true,
            stockQuantity: true,
            reservedQty: true,
          },
        },
      },
    });
  },

  async updateItem(userId: string, itemId: string, quantity: number) {
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: { select: { userId: true } },
        variant: { select: { id: true, stockQuantity: true, reservedQty: true } },
      },
    });
    if (!item) throw new NotFoundError('Cart item not found');
    if (item.cart.userId !== userId) throw new ForbiddenError('Access denied');
    const available = item.variant.stockQuantity - item.variant.reservedQty + item.quantity;
    if (available < quantity)
      throw new BadRequestError(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
    await prisma.productVariant.update({
      where: { id: item.variantId },
      data: { reservedQty: { increment: quantity - item.quantity } },
    });
    return prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  },

  async removeItem(userId: string, itemId: string) {
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundError('Cart item not found');
    if (item.cart.userId !== userId) throw new ForbiddenError('Access denied');
    await prisma.productVariant.update({
      where: { id: item.variantId },
      data: { reservedQty: { increment: -item.quantity } },
    });
    await prisma.cartItem.delete({ where: { id: itemId } });
  },

  async clearCart(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart) return;
    for (const item of cart.items) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { reservedQty: { increment: -item.quantity } },
      });
    }
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  },

  async mergeCart(userId: string, items: { variantId: string; quantity: number }[]) {
    const cart = await CartService.getCart(userId);
    for (const incoming of items) {
      const existing = cart.items.find((i) => i.variantId === incoming.variantId);
      const qty = existing ? existing.quantity + incoming.quantity : incoming.quantity;
      if (existing) {
        await CartService.updateItem(userId, existing.id, Math.min(qty, 99));
      } else {
        await CartService.addItem(userId, incoming.variantId, incoming.quantity);
      }
    }
    return CartService.getCart(userId);
  },
};

export const WishlistService = {
  async getWishlist(userId: string) {
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
                variants: {
                  select: { id: true, sellingPrice: true, mrp: true },
                  orderBy: { sellingPrice: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: { items: { include: { product: { select: { id: true, name: true, slug: true } } } } },
      });
    }
    return wishlist;
  },

  async addItem(userId: string, productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId } });
    }
    const existing = await prisma.wishlistItem.findFirst({ where: { wishlistId: wishlist.id, productId } });
    if (existing) throw new ConflictError('Product already in wishlist');
    return prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
  },

  async removeItem(userId: string, itemId: string) {
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: { wishlist: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundError('Wishlist item not found');
    if (item.wishlist.userId !== userId) throw new ForbiddenError('Access denied');
    await prisma.wishlistItem.delete({ where: { id: itemId } });
  },

  async moveToCart(userId: string, itemId: string) {
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: { wishlist: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundError('Wishlist item not found');
    if (item.wishlist.userId !== userId) throw new ForbiddenError('Access denied');
    const variant = await prisma.productVariant.findFirst({
      where: { productId: item.productId },
      orderBy: { sellingPrice: 'asc' },
    });
    if (!variant) throw new BadRequestError('Product has no variants. Cannot add to cart.');
    await CartService.addItem(userId, variant.id, 1);
    await prisma.wishlistItem.delete({ where: { id: itemId } });
    return { message: 'Item moved to cart', variantId: variant.id };
  },
};

export const OrderService = {
  async create(
    userId: string,
    data: {
      addressId: string;
      paymentMethod: string;
      khataAccountId?: string | null;
      couponCode?: string;
      deliveryCharge?: number;
      channel?: string;
    },
  ) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: { id: true, vendorId: true, gstRate: true, vendor: { select: { commissionRate: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) throw new BadRequestError('Cart is empty');
    const address = await prisma.address.findUnique({ where: { id: data.addressId } });
    if (!address || address.userId !== userId) throw new NotFoundError('Address not found');

    let subtotal = new Prisma.Decimal(0);
    let gstAmount = new Prisma.Decimal(0);
    const orderItemsData: Array<{
      variantId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      gstRate: Prisma.Decimal;
      commissionAmount?: Prisma.Decimal;
      vendorId: string;
    }> = [];
    for (const item of cart.items) {
      const variant = item.variant;
      const available = variant.stockQuantity - variant.reservedQty;
      if (available < item.quantity)
        throw new BadRequestError(`Insufficient stock for ${variant.sku}. Available: ${available}`);
      const unitPrice = variant.sellingPrice;
      const lineTotal = unitPrice.mul(item.quantity);
      subtotal = subtotal.add(lineTotal);
      const productGstRate = variant.product.gstRate || new Prisma.Decimal(0);
      gstAmount = gstAmount.add(lineTotal.mul(productGstRate).div(100));
      const commissionRate = variant.product.vendor.commissionRate;
      orderItemsData.push({
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice,
        gstRate: productGstRate,
        commissionAmount: lineTotal.mul(commissionRate).div(100),
        vendorId: variant.product.vendorId,
      });
    }

    let discountAmount = new Prisma.Decimal(0);
    if (data.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: data.couponCode } });
      if (!coupon) throw new NotFoundError('Coupon not found');
      if (!coupon.isActive || coupon.expiresAt < new Date() || coupon.startsAt > new Date())
        throw new BadRequestError('Coupon is not valid');
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
        throw new BadRequestError('Coupon usage limit reached');
      if (subtotal.lt(coupon.minimumAmount || 0))
        throw new BadRequestError(`Minimum order amount of ₹${coupon.minimumAmount} not met`);
      if (coupon.type === 'PERCENTAGE') {
        discountAmount = subtotal.mul(coupon.value).div(100);
        if (coupon.maximumDiscount && discountAmount.gt(coupon.maximumDiscount))
          discountAmount = coupon.maximumDiscount;
      } else {
        discountAmount = coupon.value;
      }
      await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
    }

    const deliveryCharge = new Prisma.Decimal(data.deliveryCharge || 0);
    const totalAmount = subtotal.add(gstAmount).add(deliveryCharge).sub(discountAmount);
    if (data.paymentMethod === 'KHATA_CREDIT') {
      if (!data.khataAccountId) throw new BadRequestError('Khata account ID required for credit payment');
      const khata = await prisma.khataAccount.findUnique({ where: { id: data.khataAccountId } });
      if (!khata) throw new NotFoundError('Khata account not found');
      if (khata.status !== 'ACTIVE') throw new BadRequestError('Khata account is not active');
      if (khata.outstandingAmount.add(totalAmount).gt(khata.creditLimitAmount))
        throw new BadRequestError(`Khata credit limit exceeded`);
    }

    const orderNumber = await generateOrderNumber();
    const order = await prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity }, reservedQty: { decrement: item.quantity } },
        });
      }
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId: data.addressId,
          subtotal,
          gstAmount,
          deliveryCharge,
          discountAmount,
          totalAmount,
          status: 'PENDING',
          paymentMethod: data.paymentMethod as PaymentMethod,
          couponCode: data.couponCode,
          channel: data.channel,
          khataAccountId: data.paymentMethod === 'KHATA_CREDIT' ? data.khataAccountId : null,
          items: {
            create: orderItemsData.map((oi) => ({
              variantId: oi.variantId,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              gstRate: oi.gstRate,
              commissionAmount: oi.commissionAmount,
            })),
          },
        },
        include: { items: true },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: newOrder.id, newStatus: 'PENDING', changedBy: userId, remarks: 'Order placed' },
      });

      const vendorGroups = new Map<string, { grossAmount: Prisma.Decimal; commissionAmount: Prisma.Decimal }>();
      for (const oi of orderItemsData) {
        const existing = vendorGroups.get(oi.vendorId);
        const lineTotal = oi.unitPrice.mul(oi.quantity);
        if (existing) {
          existing.grossAmount = existing.grossAmount.add(lineTotal);
          existing.commissionAmount = existing.commissionAmount.add(oi.commissionAmount!);
        } else {
          vendorGroups.set(oi.vendorId, { grossAmount: lineTotal, commissionAmount: oi.commissionAmount! });
        }
      }
      for (const [vendorId, values] of vendorGroups) {
        const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
        await tx.vendorCommission.create({
          data: {
            vendorId,
            orderId: newOrder.id,
            commissionRate: vendor!.commissionRate,
            grossAmount: values.grossAmount,
            commissionAmount: values.commissionAmount,
            netAmount: values.grossAmount.sub(values.commissionAmount),
          },
        });
      }

      if (data.paymentMethod === 'WALLET') {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new BadRequestError('Wallet not found');
        if (wallet.balance.lt(totalAmount)) throw new BadRequestError('Insufficient wallet balance');
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: totalAmount } } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: totalAmount,
            balanceAfter: wallet.balance.sub(totalAmount),
            remarks: `Order ${orderNumber} — held until delivery`,
            referenceId: newOrder.id,
          },
        });
      }
      if (data.paymentMethod === 'KHATA_CREDIT' && data.khataAccountId) {
        const khataAccount = await tx.khataAccount.findUnique({ where: { id: data.khataAccountId } });
        const newBalance = khataAccount!.outstandingAmount.add(totalAmount);
        await tx.khataTransaction.create({
          data: {
            khataAccountId: data.khataAccountId,
            type: 'ORDER_LINKED',
            amount: totalAmount,
            balanceAfter: newBalance,
            linkedOrderId: newOrder.id,
            performedById: userId,
            remarks: `Auto-created from order ${orderNumber}`,
          },
        });
        await tx.khataAccount.update({
          where: { id: data.khataAccountId },
          data: { outstandingAmount: newBalance, lastTransactionAt: new Date() },
        });
      }
      return newOrder;
    });
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return order;
  },

  async releaseWalletHold(orderId: string, newStatus: string) {
    if (!['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(newStatus)) return;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, totalAmount: true, paymentMethod: true, userId: true, status: true },
    });
    if (!order || order.paymentMethod !== 'WALLET') return;
    if (newStatus === 'DELIVERED') {
      await prisma.notification.create({
        data: {
          userId: order.userId,
          title: 'Payment Finalized',
          message: `Wallet payment of ₹${order.totalAmount} for order ${order.orderNumber} has been finalized.`,
          type: 'ORDER_UPDATE',
        },
      });
    } else if (['CANCELLED', 'REFUNDED'].includes(newStatus) && order.status !== newStatus) {
      const wallet = await prisma.wallet.findUnique({ where: { userId: order.userId } });
      if (wallet) {
        const newBalance = wallet.balance.add(order.totalAmount);
        await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: order.totalAmount,
            balanceAfter: newBalance,
            remarks: `Refund for cancelled order ${order.orderNumber}`,
            referenceId: order.id,
          },
        });
      }
    }
  },

  async getById(orderId: string, userId: string, requesterRole: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, fullName: true, phoneNumber: true } },
        address: true,
        items: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                variantName: true,
                product: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
        payments: true,
        shipments: { include: { events: { orderBy: { eventTime: 'desc' } } } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        returns: true,
        refunds: true,
      },
    });
    if (!order) throw new NotFoundError('Order not found');
    if (requesterRole !== 'ADMIN' && order.userId !== userId) {
      const vendor = await prisma.vendor.findUnique({ where: { userId } });
      if (!vendor) throw new ForbiddenError('Access denied');
      const vendorItems = await prisma.orderItem.findFirst({
        where: { orderId, variant: { product: { vendorId: vendor.id } } },
      });
      if (!vendorItems) throw new ForbiddenError('Access denied');
    }
    return order;
  },

  async list(
    userId: string,
    requesterRole: string,
    filters: { page: number; limit: number; status?: string; startDate?: string; endDate?: string },
  ) {
    const { page, limit, status, startDate, endDate } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {};
    if (requesterRole === 'VENDOR') {
      const vendor = await prisma.vendor.findUnique({ where: { userId } });
      if (!vendor) throw new ForbiddenError('Vendor profile not found');
      where.items = { some: { variant: { product: { vendorId: vendor.id } } } };
    } else if (requesterRole !== 'ADMIN') {
      where.userId = userId;
    }
    if (status) where.status = status as OrderStatus;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, phoneNumber: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              variant: { select: { sku: true, variantName: true, product: { select: { name: true } } } },
            },
          },
          _count: { select: { shipments: true, payments: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async cancel(orderId: string, userId: string, reason: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');
    const cancellableStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED'];
    if (!cancellableStatuses.includes(order.status as OrderStatus))
      throw new BadRequestError(`Order cannot be cancelled in ${order.status} status`);

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancellationReason: reason } });
      await tx.orderStatusHistory.create({
        data: { orderId, oldStatus: order.status, newStatus: 'CANCELLED', changedBy: userId, remarks: reason },
      });
      if (order.paymentMethod === 'WALLET') {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (wallet) {
          const newBalance = wallet.balance.add(order.totalAmount);
          await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT',
              amount: order.totalAmount,
              balanceAfter: newBalance,
              remarks: `Refund for cancelled order ${order.orderNumber}`,
              referenceId: order.id,
            },
          });
        }
      }
      if (order.paymentMethod === 'KHATA_CREDIT' && order.khataAccountId) {
        const khataAccount = await tx.khataAccount.findUnique({ where: { id: order.khataAccountId } });
        const newKhataBalance = khataAccount!.outstandingAmount.sub(order.totalAmount);
        await tx.khataAccount.update({
          where: { id: order.khataAccountId },
          data: { outstandingAmount: newKhataBalance },
        });
        await tx.khataTransaction.create({
          data: {
            khataAccountId: order.khataAccountId,
            type: 'WAIVER',
            amount: order.totalAmount,
            balanceAfter: newKhataBalance,
            linkedOrderId: orderId,
            performedById: userId,
            remarks: `Order ${order.orderNumber} cancelled — credit reversed`,
          },
        });
      }
    });
  },

  async requestReturn(orderId: string, userId: string, data: { reason: string; photoUrls?: string[] }) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('Access denied');
    const returnableStatuses: OrderStatus[] = ['DELIVERED', 'SHIPPED'];
    if (!returnableStatuses.includes(order.status as OrderStatus))
      throw new BadRequestError(`Return cannot be initiated for order in ${order.status} status`);
    await prisma.returns.create({ data: { orderId, reason: data.reason, photoUrls: data.photoUrls || [] } });
    await prisma.order.update({ where: { id: orderId }, data: { status: 'RETURNED' } });
    await prisma.orderStatusHistory.create({
      data: { orderId, oldStatus: order.status, newStatus: 'RETURNED', changedBy: userId, remarks: data.reason },
    });
  },

  async addPayment(
    orderId: string,
    userId: string,
    requesterRole: string,
    data: { amount: number; paymentMethod: string; gateway?: string; transactionId?: string; idempotencyKey?: string },
  ) {
    await OrderService.getById(orderId, userId, requesterRole);
    if (data.idempotencyKey) {
      const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) throw new ConflictError('Payment with this idempotency key already exists');
    }
    return prisma.payment.create({
      data: {
        orderId,
        amount: new Prisma.Decimal(data.amount),
        paymentMethod: data.paymentMethod as any,
        gateway: data.gateway,
        transactionId: data.transactionId,
        idempotencyKey: data.idempotencyKey,
        status: 'PENDING',
        paidAt: data.transactionId ? new Date() : undefined,
      },
    });
  },

  async getPayments(orderId: string, userId: string, requesterRole: string) {
    await OrderService.getById(orderId, userId, requesterRole);
    return prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  },

  async getStatusHistory(orderId: string, userId: string, requesterRole: string) {
    await OrderService.getById(orderId, userId, requesterRole);
    return prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { changedAt: 'desc' } });
  },

  async updateOrderStatus(orderId: string, vendorUserId: string, data: { status: string; remarks?: string }) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { variant: { select: { product: { select: { vendorId: true } } } } } } },
    });
    if (!order) throw new NotFoundError('Order not found');
    const hasItem = order.items.some((i) => i.variant.product.vendorId === vendor.id);
    if (!hasItem) throw new ForbiddenError('No items in this order belong to your shop');
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['PACKED', 'CANCELLED'],
      PACKED: ['SHIPPED'],
      SHIPPED: ['DELIVERED'],
    };
    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(data.status))
      throw new BadRequestError(`Cannot transition from ${order.status} to ${data.status}`);
    if (data.status === 'DELIVERED') {
      await OrderService.releaseWalletHold(orderId, 'DELIVERED');
    }
    const result = await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status: data.status as OrderStatus } }),
      prisma.orderStatusHistory.create({
        data: {
          orderId,
          oldStatus: order.status,
          newStatus: data.status as OrderStatus,
          changedBy: vendorUserId,
          remarks: data.remarks,
        },
      }),
    ]);
    return result[0];
  },
};

export const ShipmentService = {
  async create(
    orderId: string,
    data: { logisticsPartner?: string; awbNumber?: string; pickupEta?: Date; deliveryEta?: Date },
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    return prisma.shipment.create({
      data: {
        orderId,
        logisticsPartner: data.logisticsPartner,
        awbNumber: data.awbNumber,
        pickupEta: data.pickupEta,
        deliveryEta: data.deliveryEta,
      },
    });
  },

  async getByOrder(orderId: string) {
    return prisma.shipment.findMany({ where: { orderId }, include: { events: { orderBy: { eventTime: 'desc' } } } });
  },

  async update(shipmentId: string, data: any) {
    const updateData: Prisma.ShipmentUpdateInput = {};
    for (const field of [
      'logisticsPartner',
      'awbNumber',
      'pickupEta',
      'deliveryEta',
      'podImageUrl',
      'currentStatus',
      'deliveryAttempts',
    ]) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    return prisma.shipment.update({ where: { id: shipmentId }, data: updateData });
  },

  async addEvent(
    shipmentId: string,
    data: { eventStatus: string; location?: string; geoLat?: number; geoLng?: number; source?: string },
  ) {
    return prisma.shipmentEvent.create({
      data: {
        shipmentId,
        eventStatus: data.eventStatus,
        location: data.location,
        geoLat: data.geoLat ? new Prisma.Decimal(data.geoLat) : undefined,
        geoLng: data.geoLng ? new Prisma.Decimal(data.geoLng) : undefined,
        source: data.source,
      },
    });
  },

  async getEvents(shipmentId: string) {
    return prisma.shipmentEvent.findMany({ where: { shipmentId }, orderBy: { eventTime: 'desc' } });
  },
};
