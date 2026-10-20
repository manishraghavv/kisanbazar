import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { InvoiceService } from './invoice.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver');

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

/** Admin: every invoice and credit note of the given orders, one PDF each, in a ZIP. */
export const downloadBulkInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ success: false, message: 'orderIds array is required' });
      return;
    }
    if (orderIds.length > 50) {
      res.status(400).json({ success: false, message: 'Maximum 50 orders per bulk download' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices-bulk.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const orderId of orderIds) {
      try {
        const invoices = await InvoiceService.listForOrder(orderId, { id: req.user.id, role: req.user.role });
        for (const invoice of invoices) {
          const doc = InvoiceService.renderPdf(invoice);
          const buffers: Buffer[] = [];
          doc.on('data', (chunk: Buffer) => buffers.push(chunk));
          await new Promise<void>((resolve, reject) => {
            doc.on('end', () => {
              archive.append(Buffer.concat(buffers), {
                name: `${invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`,
              });
              resolve();
            });
            doc.on('error', reject);
          });
        }
      } catch {
        // Skip failed orders
        archive.append(`Failed to generate invoices for order ${orderId}`, { name: `failed-${orderId}.txt` });
      }
    }

    await archive.finalize();
  } catch (err) {
    handleServiceError(err, res);
  }
};
