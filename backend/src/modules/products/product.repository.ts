import { injectable } from 'tsyringe';
import { BaseRepository } from '../../common/lib/base.repository';

@injectable()
export class ProductRepository extends BaseRepository {
  // ── Categories ────────────────────────────────────────────────────────────
  createCategory(data: any) { return this.prisma.category.create({ data, include: { parent: { select: { id: true, name: true, slug: true } } } }); }
  findCategoryById(id: string) { return this.prisma.category.findUnique({ where: { id } }); }
  findCategoryBySlug(slug: string) { return this.prisma.category.findUnique({ where: { slug } }); }
  updateCategory(id: string, data: any) { return this.prisma.category.update({ where: { id }, data, include: { parent: { select: { id: true, name: true, slug: true } } } }); }
  deleteCategory(id: string) { return this.prisma.category.delete({ where: { id } }); }
  listCategories(where: any, skip: number, take: number) { return this.prisma.category.findMany({ where, skip, take, orderBy: { sortOrder: 'asc' }, include: { parent: { select: { id: true, name: true, slug: true } }, _count: { select: { products: true, children: true } } } }); }
  countCategories(where: any) { return this.prisma.category.count({ where }); }
  getCategoryTree() { return this.prisma.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: 'asc' }, include: { children: { orderBy: { sortOrder: 'asc' }, include: { children: { orderBy: { sortOrder: 'asc' } } } } } }); }

  // ── Products ──────────────────────────────────────────────────────────────
  createProduct(data: any) { return this.prisma.product.create({ data, include: { category: { select: { id: true, name: true, slug: true } } } }); }
  findProductById(id: string, include?: any) { return this.prisma.product.findUnique({ where: { id }, ...(include ? { include } : {}) }); }
  updateProduct(id: string, data: any) { return this.prisma.product.update({ where: { id }, data }); }
  listProducts(where: any, skip: number, take: number, orderBy: any, include: any) { return this.prisma.product.findMany({ where, skip, take, orderBy, include }); }
  countProducts(where: any) { return this.prisma.product.count({ where }); }

  // ── Variants ──────────────────────────────────────────────────────────────
  createVariant(data: any) { return this.prisma.productVariant.create({ data }); }
  findVariantById(id: string, include?: any) { return this.prisma.productVariant.findUnique({ where: { id }, ...(include ? { include } : {}) }); }
  findVariantBySku(sku: string) { return this.prisma.productVariant.findUnique({ where: { sku } }); }
  updateVariant(id: string, data: any) { return this.prisma.productVariant.update({ where: { id }, data }); }
  deleteVariant(id: string) { return this.prisma.productVariant.delete({ where: { id } }); }
  listVariants(productId: string) { return this.prisma.productVariant.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } }); }
  listVariantsByVendor(vendorId: string) { return this.prisma.productVariant.findMany({ where: { product: { vendorId } }, include: { product: { select: { id: true, name: true, slug: true } } }, orderBy: { stockQuantity: 'asc' } }); }

  // ── Images ────────────────────────────────────────────────────────────────
  clearPrimaryImages(productId: string) { return this.prisma.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } }); }
  createImage(data: any) { return this.prisma.productImage.create({ data }); }
  findImageById(id: string) { return this.prisma.productImage.findUnique({ where: { id }, include: { product: { include: { vendor: { select: { userId: true } } } } } }); }
  findImageByProduct(id: string, productId: string) { return this.prisma.productImage.findFirst({ where: { id, productId } }); }
  updateImage(id: string, data: any) { return this.prisma.productImage.update({ where: { id }, data }); }
  deleteImage(id: string) { return this.prisma.productImage.delete({ where: { id } }); }
  listImages(productId: string) { return this.prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } }); }

  // ── Attributes ────────────────────────────────────────────────────────────
  createAttribute(data: any) { return this.prisma.productAttribute.create({ data }); }
  findAttributeById(id: string, productId: string) { return this.prisma.productAttribute.findFirst({ where: { id, productId }, include: { product: { include: { vendor: { select: { userId: true } } } } } }); }
  updateAttribute(id: string, data: any) { return this.prisma.productAttribute.update({ where: { id }, data }); }
  deleteAttribute(id: string) { return this.prisma.productAttribute.delete({ where: { id } }); }

  // ── Inventory ─────────────────────────────────────────────────────────────
  createInventoryLog(data: any) { return this.prisma.inventory.create({ data }); }
  listInventoryLogs(where: any, skip: number, take: number) { return this.prisma.inventory.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { variant: { select: { id: true, sku: true, variantName: true, product: { select: { name: true } } } } } }); }
  countInventoryLogs(where: any) { return this.prisma.inventory.count({ where }); }

  // ── Vendor ────────────────────────────────────────────────────────────────
  findVendorByUserId(userId: string) { return this.prisma.vendor.findUnique({ where: { userId } }); }
}
