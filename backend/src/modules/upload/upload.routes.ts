import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { authenticate, authorize } from '../../common/middleware/authMiddleware';
import { createRateLimiter } from '../../common/middleware/rateLimiter';
import { detectImageType } from '../../common/utils/imageSignature';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Validates the file's magic bytes and stores it under a random server-chosen name
 * (extension derived from the detected type, never from the client's filename).
 * Returns null when the bytes are not a supported image.
 */
export async function saveImage(buffer: Buffer, dir: string = UPLOAD_DIR): Promise<string | null> {
  const detected = detectImageType(buffer);
  if (!detected) return null;

  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}${detected.ext}`;
  await fs.promises.writeFile(path.join(dir, filename), buffer, { flag: 'wx' });
  return filename;
}

// Memory storage: nothing touches disk until the bytes have been verified.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const uploadLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many uploads. Please wait a moment.',
});

const router = Router();

// Product images are uploaded by vendors (and admins on their behalf).
router.post(
  '/upload',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  uploadLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        const tooLarge = err.code === 'LIMIT_FILE_SIZE';
        res
          .status(tooLarge ? 413 : 400)
          .json({ success: false, message: tooLarge ? 'File too large (max 5 MB)' : err.message });
        return;
      }
      if (err) return next(err);
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const filename = await saveImage(req.file.buffer);
    if (!filename) {
      res.status(400).json({ success: false, message: 'Only JPG, PNG, and WebP images are allowed' });
      return;
    }

    const baseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8000}`;
    res.status(201).json({ success: true, data: { url: `${baseUrl}/uploads/${filename}` } });
  },
);

export default router;
