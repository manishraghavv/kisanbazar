import {
  Prisma,
  ProductStatus,
  ModerationStatus,
} from '@prisma/client';
import { prisma } from '../../common/lib/prisma';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../common/errors';

export const CategoryService = {
  async create(data: {
    name: string; nameHi?: string; slug?: string; parentId?: string | null;
    iconUrl?: string; sortOrder?: number;
  }) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictError(`Category with slug "${slug}" already exists`);
    if (data.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new NotFoundError('Parent category not found');
    }
    return prisma.category.create({
      data: {
        name: data.name, nameHi: data.nameHi, slug,
        parentId: data.parentId ?? null, iconUrl: data.iconUrl, sortOrder: data.sortOrder ?? 0,
      },
      include: { parent: { select: { id: true, name: true, slug: true } } },
    });
  },

  async update(id: string, data: {
    name?: string; nameHi?: string; slug?: string; parentId?: string | null;
    iconUrl?: string; sortOrder?: number;
  }) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category not found');
    if (data.slug && data.slug !== category.slug) {
      const slugExists = await prisma.category.findUnique({ where: { slug: data.slug } });
      if (slugExists) throw new ConflictError(`Slug "${data.slug}" already in use`);
    }
    if (data.parentId) {
      if (data.parentId === id) throw new BadRequestError('Category cannot be its own parent');
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new NotFoundError('Parent category not found');
    }
    return prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameHi !== undefined && { nameHi: data.nameHi }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
      include: { parent: { select: { id: true, name: true, slug: true } } },
    });
  },

  async getById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: { select: { id: true, name: true, slug: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true } },
      },
    });
    if (!category) throw new NotFoundError('Category not found');
    return category;
  },

  async list(filters: { page: number; limit: number; search?: string; parentId?: string | null }) {
    const { page, limit, search, parentId } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.CategoryWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { nameHi: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (parentId !== undefined) where.parentId = parentId === 'null' ? null : parentId;
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where, skip, take: limit, orderBy: { sortOrder: 'asc' },
        include: { parent: { select: { id: true, name: true, slug: true } }, _count: { select: { products: true, children: true } } },
      }),
      prisma.category.count({ where }),
    ]);
    return { categories, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async delete(id: string) {
    const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
    if (!category) throw new NotFoundError('Category not found');
    if (category._count.products > 0) throw new BadRequestError('Cannot delete category with associated products.');
    if (category._count.children > 0) throw new BadRequestError('Cannot delete category with subcategories.');
    await prisma.category.delete({ where: { id } });
  },

  async getTree() {
    return prisma.category.findMany({
      where: { parentId: null }, orderBy: { sortOrder: 'asc' },
      include: { children: { orderBy: { sortOrder: 'asc' }, include: { children: { orderBy: { sortOrder: 'asc' } } } } },
    });
  },
};

function generateProductSlug(name: string, vendorId: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base}-${vendorId.slice(0, 8)}`;
}

export const ProductService = {
  async create(vendorUserId: string, data: {
    categoryId: string; name: string; nameHi?: string; description?: string; descriptionHi?: string;
    hsnCode?: string; gstRate?: number; unitOfMeasure?: string; applicableCrops?: string[]; seasonalFlag?: boolean;
  }) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    if (vendor.kycStatus !== 'APPROVED') throw new ForbiddenError('KYC must be approved before publishing products');
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new NotFoundError('Category not found');
    const slug = generateProductSlug(data.name, vendor.id);
    return prisma.product.create({
      data: {
        vendorId: vendor.id, categoryId: data.categoryId, name: data.name, nameHi: data.nameHi, slug,
        description: data.description, descriptionHi: data.descriptionHi, hsnCode: data.hsnCode,
        gstRate: data.gstRate ? new Prisma.Decimal(data.gstRate) : undefined,
        unitOfMeasure: data.unitOfMeasure, applicableCrops: data.applicableCrops || [],
        seasonalFlag: data.seasonalFlag ?? false, status: 'DRAFT', moderationStatus: 'PENDING',
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  },

  async update(productId: string, vendorUserId: string, requesterRole: string, data: any) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { userId: true } } } });
    if (!product) throw new NotFoundError('Product not found');
    if (requesterRole === 'VENDOR' && product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');

    const updateData: Prisma.ProductUpdateInput = {};
    const allowedFields = ['categoryId', 'name', 'nameHi', 'description', 'descriptionHi', 'hsnCode', 'gstRate', 'unitOfMeasure', 'applicableCrops', 'seasonalFlag', 'status'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'gstRate') { updateData[field] = new Prisma.Decimal(data[field]); }
        else { (updateData as any)[field] = data[field]; }
      }
    }
    if (requesterRole === 'VENDOR' && product.moderationStatus !== 'PENDING') {
      if (data.name || data.description || data.hsnCode) { updateData.moderationStatus = 'PENDING'; }
    }
    return prisma.product.update({
      where: { id: productId }, data: updateData,
      include: { category: { select: { id: true, name: true, slug: true } }, variants: { select: { id: true, sku: true, variantName: true, sellingPrice: true, stockQuantity: true } } },
    });
  },

  async moderate(productId: string, data: { status: 'APPROVED' | 'REJECTED'; moderationNote?: string }) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');
    const moderationStatus = data.status as ModerationStatus;
    const productStatus = data.status === 'APPROVED' ? 'ACTIVE' : 'DRAFT';
    return prisma.product.update({ where: { id: productId }, data: { moderationStatus, status: productStatus as ProductStatus } });
  },

  async getById(productId: string) {
    return prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true, slug: true, nameHi: true } },
        vendor: { select: { id: true, businessName: true, kycStatus: true, user: { select: { fullName: true } } } },
        variants: { orderBy: { createdAt: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        attributes: true,
        _count: { select: { reviews: true, views: true } },
      },
    });
  },

  async list(filters: { page: number; limit: number; search?: string; categoryId?: string; vendorId?: string; status?: string; minPrice?: number; maxPrice?: number; seasonalFlag?: boolean; crop?: string; sortBy: string; sortOrder: string; inStockOnly?: boolean; minRating?: number }) {
    const { page, limit, search, categoryId, vendorId, status, minPrice, maxPrice, seasonalFlag, crop, sortBy, sortOrder, inStockOnly, minRating } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = { ...(status ? {} : { moderationStatus: 'APPROVED' as ModerationStatus, status: 'ACTIVE' as ProductStatus }) };
    if (status) where.status = status as ProductStatus;
    if (categoryId) where.categoryId = categoryId;
    if (vendorId) where.vendorId = vendorId;
    if (seasonalFlag !== undefined) where.seasonalFlag = seasonalFlag;
    if (crop) where.applicableCrops = { has: crop };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { nameHi: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (minPrice !== undefined || maxPrice !== undefined || inStockOnly) {
      where.variants = {
        some: {
          ...(minPrice !== undefined || maxPrice !== undefined ? { sellingPrice: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } } : {}),
          ...(inStockOnly ? { stockQuantity: { gt: 0 } } : {}),
        },
      };
    }
    if (minRating !== undefined && minRating > 0) {
      where.reviews = { some: { rating: { gte: minRating } } };
    }
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (sortBy === 'name') orderBy.name = sortOrder as Prisma.SortOrder;
    else if (sortBy === 'updatedAt') orderBy.updatedAt = sortOrder as Prisma.SortOrder;
    else orderBy.createdAt = sortOrder as Prisma.SortOrder;
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit, orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          vendor: { select: { id: true, businessName: true } },
          variants: { select: { id: true, sku: true, variantName: true, mrp: true, sellingPrice: true, stockQuantity: true }, orderBy: { sellingPrice: 'asc' } },
          images: { where: { isPrimary: true }, select: { imageUrl: true }, take: 1 },
          _count: { select: { reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async delete(productId: string, vendorUserId: string, requesterRole: string) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { userId: true } } } });
    if (!product) throw new NotFoundError('Product not found');
    if (requesterRole === 'VENDOR' && product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    await prisma.product.update({ where: { id: productId }, data: { status: 'DISCONTINUED' as ProductStatus } });
  },

  async submitForModeration(productId: string, vendorUserId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { userId: true } } } });
    if (!product) throw new NotFoundError('Product not found');
    if (product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    return prisma.product.update({ where: { id: productId }, data: { moderationStatus: 'PENDING' as ModerationStatus, status: 'DRAFT' as ProductStatus } });
  },

  async createVariant(productId: string, vendorUserId: string, data: { sku: string; variantName?: string; mrp: number; sellingPrice: number; stockQuantity?: number; reorderThreshold?: number; weightGrams?: number; attributes?: any }) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { userId: true } } } });
    if (!product) throw new NotFoundError('Product not found');
    if (product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    const existingSku = await prisma.productVariant.findUnique({ where: { sku: data.sku } });
    if (existingSku) throw new ConflictError(`SKU "${data.sku}" already exists`);
    return prisma.productVariant.create({ data: { productId, sku: data.sku, variantName: data.variantName, mrp: new Prisma.Decimal(data.mrp), sellingPrice: new Prisma.Decimal(data.sellingPrice), stockQuantity: data.stockQuantity ?? 0, reorderThreshold: data.reorderThreshold ?? 0, weightGrams: data.weightGrams, attributes: data.attributes ?? undefined } });
  },

  async updateVariant(variantId: string, vendorUserId: string, data: any) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: { include: { vendor: { select: { userId: true } } } } } });
    if (!variant) throw new NotFoundError('Variant not found');
    if (variant.product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    if (data.sku && data.sku !== variant.sku) {
      const skuExists = await prisma.productVariant.findUnique({ where: { sku: data.sku } });
      if (skuExists) throw new ConflictError(`SKU "${data.sku}" already exists`);
    }
    const updateData: Prisma.ProductVariantUpdateInput = {};
    const allowedFields = ['sku', 'variantName', 'mrp', 'sellingPrice', 'stockQuantity', 'reorderThreshold', 'weightGrams', 'attributes'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'mrp' || field === 'sellingPrice') { updateData[field] = new Prisma.Decimal(data[field]); }
        else { (updateData as any)[field] = data[field]; }
      }
    }
    return prisma.productVariant.update({ where: { id: variantId }, data: updateData });
  },

  async deleteVariant(variantId: string, vendorUserId: string) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: { include: { vendor: { select: { userId: true } } } } } });
    if (!variant) throw new NotFoundError('Variant not found');
    if (variant.product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    await prisma.productVariant.delete({ where: { id: variantId } });
  },

  async getVariants(productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');
    return prisma.productVariant.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } });
  },

  async addImage(productId: string, vendorUserId: string, data: { imageUrl: string; isPrimary?: boolean; sortOrder?: number }) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { userId: true } } } });
    if (!product) throw new NotFoundError('Product not found');
    if (product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    if (data.isPrimary) { await prisma.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } }); }
    return prisma.productImage.create({ data: { productId, imageUrl: data.imageUrl, isPrimary: data.isPrimary ?? false, sortOrder: data.sortOrder ?? 0 } });
  },

  async deleteImage(imageId: string, vendorUserId: string) {
    const image = await prisma.productImage.findUnique({ where: { id: imageId }, include: { product: { include: { vendor: { select: { userId: true } } } } } });
    if (!image) throw new NotFoundError('Image not found');
    if (image.product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    await prisma.productImage.delete({ where: { id: imageId } });
  },

  async setPrimaryImage(imageId: string, productId: string, vendorUserId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { userId: true } } } });
    if (!product) throw new NotFoundError('Product not found');
    if (product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundError('Image not found for this product');
    await prisma.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
    return prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  },

  async getImages(productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');
    return prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } });
  },

  async addAttribute(productId: string, vendorUserId: string, data: { name: string; value: string; nameHi?: string }) {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { vendor: { select: { userId: true } } } });
    if (!product) throw new NotFoundError('Product not found');
    if (product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    return prisma.productAttribute.create({ data: { productId, name: data.name, value: data.value, nameHi: data.nameHi } });
  },

  async updateAttribute(attributeId: string, productId: string, vendorUserId: string, data: { name?: string; value?: string; nameHi?: string }) {
    const attribute = await prisma.productAttribute.findFirst({ where: { id: attributeId, productId }, include: { product: { include: { vendor: { select: { userId: true } } } } } });
    if (!attribute) throw new NotFoundError('Attribute not found');
    if (attribute.product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    return prisma.productAttribute.update({ where: { id: attributeId }, data: { ...(data.name !== undefined && { name: data.name }), ...(data.value !== undefined && { value: data.value }), ...(data.nameHi !== undefined && { nameHi: data.nameHi }) } });
  },

  async deleteAttribute(attributeId: string, productId: string, vendorUserId: string) {
    const attribute = await prisma.productAttribute.findFirst({ where: { id: attributeId, productId }, include: { product: { include: { vendor: { select: { userId: true } } } } } });
    if (!attribute) throw new NotFoundError('Attribute not found');
    if (attribute.product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    await prisma.productAttribute.delete({ where: { id: attributeId } });
  },
};

export const InventoryService = {
  async adjust(vendorUserId: string, data: { variantId: string; quantityChange: number; reason: string; referenceId?: string }) {
    const variant = await prisma.productVariant.findUnique({ where: { id: data.variantId }, include: { product: { include: { vendor: { select: { userId: true } } } } } });
    if (!variant) throw new NotFoundError('Variant not found');
    if (variant.product.vendor.userId !== vendorUserId) throw new ForbiddenError('Access denied');
    const newQty = variant.stockQuantity + data.quantityChange;
    if (newQty < 0) throw new BadRequestError(`Insufficient stock. Available: ${variant.stockQuantity}, Requested change: ${data.quantityChange}`);
    const [log] = await prisma.$transaction([
      prisma.inventory.create({ data: { variantId: data.variantId, quantityChange: data.quantityChange, reason: data.reason, referenceId: data.referenceId, performedById: vendorUserId } }),
      prisma.productVariant.update({ where: { id: data.variantId }, data: { stockQuantity: newQty } }),
    ]);
    return log;
  },

  async getLowStock(vendorUserId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    const allVariants = await prisma.productVariant.findMany({
      where: { product: { vendorId: vendor.id } },
      include: { product: { select: { id: true, name: true, slug: true } } },
      orderBy: { stockQuantity: 'asc' },
    });
    return allVariants.filter((v) => v.stockQuantity <= v.reorderThreshold);
  },

  async getLogs(vendorUserId: string, filters: { page: number; limit: number; variantId?: string }) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ForbiddenError('Vendor profile not found');
    const { page, limit, variantId } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.InventoryWhereInput = { variant: { product: { vendorId: vendor.id } } };
    if (variantId) where.variantId = variantId;
    const [logs, total] = await Promise.all([
      prisma.inventory.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { variant: { select: { id: true, sku: true, variantName: true, product: { select: { name: true } } } } } }),
      prisma.inventory.count({ where }),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
};
