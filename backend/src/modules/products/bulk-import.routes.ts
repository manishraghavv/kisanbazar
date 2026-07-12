import { Router, Request, Response } from 'express';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import multer from 'multer';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AuthRequest } from '../../common/types/express.d';
import { prisma } from '../../common/lib/prisma';
import { ConflictError, BadRequestError } from '../../common/errors';
import { Prisma } from '@prisma/client';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const router = Router();

interface CsvRow {
  name: string;
  description?: string;
  category_slug: string;
  unit?: string;
  sku: string;
  mrp: string;
  selling_price: string;
  stock: string;
  status?: string;
}

interface ImportResult {
  row: number;
  name: string;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
}

router.post(
  '/products/bulk-import',
  authenticate,
  authorize('VENDOR'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    if (!req.file) throw new BadRequestError('CSV file is required');

    // Find vendor
    const vendor = await prisma.vendor.findUnique({ where: { userId: authReq.user.id } });
    if (!vendor) throw new BadRequestError('Vendor profile not found');

    // Parse CSV
    const rows: CsvRow[] = await new Promise((resolve, reject) => {
      const results: CsvRow[] = [];
      Readable.from(req.file!.buffer)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row: CsvRow) => results.push(row))
        .on('end', () => resolve(results))
        .on('error', reject);
    });

    if (rows.length === 0) throw new BadRequestError('CSV file is empty');
    if (rows.length > 200) throw new BadRequestError('Maximum 200 rows per import');

    const results: ImportResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      try {
        // Validate required fields
        if (!row.name?.trim()) throw new Error('name is required');
        if (!row.category_slug?.trim()) throw new Error('category_slug is required');
        if (!row.sku?.trim()) throw new Error('sku is required');
        const mrp = parseFloat(row.mrp);
        const sellingPrice = parseFloat(row.selling_price);
        const stock = parseInt(row.stock ?? '0', 10);
        if (isNaN(mrp) || mrp <= 0) throw new Error('mrp must be a positive number');
        if (isNaN(sellingPrice) || sellingPrice <= 0) throw new Error('selling_price must be a positive number');
        if (sellingPrice > mrp) throw new Error('selling_price cannot exceed mrp');
        if (isNaN(stock) || stock < 0) throw new Error('stock must be a non-negative integer');

        // Find category
        const category = await prisma.category.findFirst({
          where: { slug: row.category_slug.toLowerCase().trim() },
        });
        if (!category) throw new Error(`category_slug "${row.category_slug}" not found`);

        // Check SKU uniqueness
        const skuExists = await prisma.productVariant.findUnique({ where: { sku: row.sku.trim() } });
        if (skuExists) throw new Error(`SKU "${row.sku}" already exists`);

        // Generate unique slug
        const baseSlug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let slug = baseSlug;
        let suffix = 1;
        while (await prisma.product.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${suffix++}`;
        }

        // Create product + variant in a transaction
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              vendorId: vendor.id,
              categoryId: category.id,
              name: row.name.trim(),
              slug,
              description: row.description?.trim() || null,
              unitOfMeasure: row.unit?.trim() || null,
              status: 'DRAFT',
              moderationStatus: 'PENDING',
            },
          });

          await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: row.sku.trim(),
              mrp: new Prisma.Decimal(mrp),
              sellingPrice: new Prisma.Decimal(sellingPrice),
              stockQuantity: stock,
              reorderThreshold: 0,
            },
          });
        });

        results.push({ row: rowNum, name: row.name.trim(), status: 'created' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ row: rowNum, name: row.name?.trim() ?? `Row ${rowNum}`, status: 'error', reason: msg });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const errors = results.filter((r) => r.status === 'error').length;

    res.status(207).json({
      success: true,
      message: `Import complete: ${created} created, ${errors} failed`,
      summary: { total: rows.length, created, errors },
      results,
    });
  })
);

export default router;
