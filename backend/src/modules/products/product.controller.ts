import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { CategoryService, ProductService, InventoryService } from './product.service';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await CategoryService.create(req.body);
    res.status(201).json({ success: true, message: 'Category created', data: category });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await CategoryService.update(req.params.id as string, req.body);
    res.json({ success: true, message: 'Category updated', data: category });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getCategoryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await CategoryService.getById(req.params.id as string);
    res.json({ success: true, data: category });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await CategoryService.list({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      search: req.query.search as string | undefined,
      parentId: req.query.parentId as string | undefined,
    });
    res.json({
      success: true,
      data: result.categories,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await CategoryService.delete(req.params.id as string);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getCategoryTree = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tree = await CategoryService.getTree();
    res.json({ success: true, data: tree });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getCategoryProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ProductService.list({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      categoryId: req.params.id as string,
      search: req.query.search as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      seasonalFlag: req.query.seasonalFlag === 'true' ? true : req.query.seasonalFlag === 'false' ? false : undefined,
      crop: req.query.crop as string | undefined,
      sortBy: (req.query.sortBy as string) || 'createdAt',
      sortOrder: (req.query.sortOrder as string) || 'desc',
    });
    res.json({
      success: true,
      data: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await ProductService.create(req.user.id, req.body);
    res
      .status(201)
      .json({ success: true, message: 'Product created. Submit for moderation when ready.', data: product });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await ProductService.update(req.params.id as string, req.user.id, req.user.role, req.body);
    res.json({ success: true, message: 'Product updated', data: product });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const moderateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await ProductService.moderate(req.params.id as string, req.body);
    res.json({ success: true, message: `Product ${req.body.status.toLowerCase()} successfully`, data: product });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await ProductService.getById(req.params.id as string);
    res.json({ success: true, data: product });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ProductService.list({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      search: req.query.search as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      vendorId: req.query.vendorId as string | undefined,
      status: req.query.status as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      seasonalFlag: req.query.seasonalFlag === 'true' ? true : req.query.seasonalFlag === 'false' ? false : undefined,
      crop: req.query.crop as string | undefined,
      sortBy: (req.query.sortBy as string) || 'createdAt',
      sortOrder: (req.query.sortOrder as string) || 'desc',
      inStockOnly: req.query.inStockOnly === 'true' ? true : undefined,
      minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
    });
    res.json({
      success: true,
      data: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ProductService.delete(req.params.id as string, req.user.id, req.user.role);
    res.json({ success: true, message: 'Product discontinued' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const submitForModeration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await ProductService.submitForModeration(req.params.id as string, req.user.id);
    res.json({ success: true, message: 'Product submitted for moderation', data: product });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const createVariant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const variant = await ProductService.createVariant(req.params.id as string, req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Variant created', data: variant });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateVariant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const variant = await ProductService.updateVariant(req.params.variantId as string, req.user.id, req.body);
    res.json({ success: true, message: 'Variant updated', data: variant });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteVariant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ProductService.deleteVariant(req.params.variantId as string, req.user.id);
    res.json({ success: true, message: 'Variant deleted' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getVariants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const variants = await ProductService.getVariants(req.params.id as string);
    res.json({ success: true, data: variants });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  IMAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const addImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const image = await ProductService.addImage(req.params.id as string, req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Image added', data: image });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ProductService.deleteImage(req.params.imageId as string, req.user.id);
    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const setPrimaryImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const image = await ProductService.setPrimaryImage(
      req.params.imageId as string,
      req.params.id as string,
      req.user.id,
    );
    res.json({ success: true, message: 'Primary image updated', data: image });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getImages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const images = await ProductService.getImages(req.params.id as string);
    res.json({ success: true, data: images });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ATTRIBUTES
// ═══════════════════════════════════════════════════════════════════════════════

export const addAttribute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attribute = await ProductService.addAttribute(req.params.id as string, req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Attribute added', data: attribute });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateAttribute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attribute = await ProductService.updateAttribute(
      req.params.attributeId as string,
      req.params.id as string,
      req.user.id,
      req.body,
    );
    res.json({ success: true, message: 'Attribute updated', data: attribute });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteAttribute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ProductService.deleteAttribute(req.params.attributeId as string, req.params.id as string, req.user.id);
    res.json({ success: true, message: 'Attribute deleted' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

export const adjustInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const log = await InventoryService.adjust(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Inventory adjusted', data: log });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getLowStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const variants = await InventoryService.getLowStock(req.user.id);
    res.json({ success: true, data: variants });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getInventoryLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await InventoryService.getLogs(req.user.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      variantId: req.query.variantId as string | undefined,
    });
    res.json({
      success: true,
      data: result.logs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};
