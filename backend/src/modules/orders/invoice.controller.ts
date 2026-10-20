import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { InvoiceService } from './order.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver');

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  B.1 — INVOICE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export const downloadInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await InvoiceService.generateInvoice(
      req.params.id as string,
      req.user.id,
      req.user.role,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    doc.pipe(res);
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getInvoiceData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await InvoiceService.getInvoiceData(
      req.params.id as string,
      req.user.id,
      req.user.role,
    );
    res.json({ success: true, data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const downloadBulkInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ success: false, message: 'orderIds array is required' });
      return;
    }
    if (orderIds.length > 50) {
      res.status(400).json({ success: false, message: 'Maximum 50 invoices per bulk download' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices-bulk.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const orderId of orderIds) {
      try {
        const doc = await InvoiceService.generateInvoice(orderId, req.user.id, req.user.role);
        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        await new Promise<void>((resolve, reject) => {
          doc.on('end', () => {
            archive.append(Buffer.concat(buffers), { name: `invoice-${orderId}.pdf` });
            resolve();
          });
          doc.on('error', reject);
        });
      } catch {
        // Skip failed invoices
        archive.append(`Failed to generate invoice for order ${orderId}`, { name: `failed-${orderId}.txt` });
      }
    }

    await archive.finalize();
  } catch (err) {
    handleServiceError(err, res);
  }
};
