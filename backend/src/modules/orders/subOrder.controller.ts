import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { SubOrderService } from './subOrder.service';
import { ShipmentService } from './order.service';
import { ReturnService } from './return.service';
import { InvoiceService } from './invoice.service';
import { NotFoundError } from '../../common/errors';
import { prisma } from '../../common/lib/prisma';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

const actorOf = (req: AuthRequest) => ({ id: req.user.id, role: req.user.role });
const idParam = (req: AuthRequest, name = 'id') => req.params[name] as string;

function pagination(result: { page: number; limit: number; total: number; totalPages: number }) {
  return { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

export const listSubOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await SubOrderService.list(actorOf(req), {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
      vendorId: req.query.vendorId as string | undefined,
    });
    res.json({ success: true, data: result.subOrders, pagination: pagination(result) });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getSubOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await SubOrderService.getById(idParam(req), actorOf(req)) });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateSubOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await SubOrderService.updateStatus(actorOf(req), idParam(req), req.body);
    res.json({
      success: true,
      message: `Sub-order status updated to ${req.body.status}`,
      data: result.subOrder,
      refund: result.refund,
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const cancelSubOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await SubOrderService.cancelAsCustomer(req.user.id, idParam(req), req.body.reason);
    res.json({ success: true, message: 'Sub-order cancelled', data: result.subOrder, refund: result.refund });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const createSubOrderShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shipment = await ShipmentService.create(actorOf(req), idParam(req), {
      ...req.body,
      ...(req.body.pickupEta && { pickupEta: new Date(req.body.pickupEta) }),
      ...(req.body.deliveryEta && { deliveryEta: new Date(req.body.deliveryEta) }),
    });
    res.status(201).json({ success: true, message: 'Shipment created', data: shipment });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  RETURNS
// ═══════════════════════════════════════════════════════════════════════════════

export const requestReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ret = await ReturnService.request(req.user.id, idParam(req), req.body);
    res.status(201).json({ success: true, message: 'Return requested', data: ret });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listReturns = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await ReturnService.list(actorOf(req), {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
      subOrderId: req.query.subOrderId as string | undefined,
    });
    res.json({ success: true, data: result.returns, pagination: pagination(result) });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await ReturnService.getById(idParam(req), actorOf(req)) });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const approveReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      message: 'Return approved',
      data: await ReturnService.approve(actorOf(req), idParam(req), req.body.note),
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const rejectReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      message: 'Return rejected',
      data: await ReturnService.reject(actorOf(req), idParam(req), req.body.note),
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const receiveReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      message: 'Return received',
      data: await ReturnService.receive(actorOf(req), idParam(req), { restock: req.body.restock }),
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const resolveReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      message: 'Return refunded',
      data: await ReturnService.resolve(actorOf(req), idParam(req)),
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  INVOICES (per sub-order)
// ═══════════════════════════════════════════════════════════════════════════════

export const listSubOrderInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await InvoiceService.listForSubOrder(idParam(req), actorOf(req)) });
  } catch (err) {
    handleServiceError(err, res);
  }
};

function sendPdf(res: Response, invoice: Parameters<typeof InvoiceService.renderPdf>[0]): void {
  const doc = InvoiceService.renderPdf(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '-')}.pdf"`,
  );
  doc.pipe(res);
}

/** The tax invoice PDF of a sub-order. */
export const downloadSubOrderInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invoices = await InvoiceService.listForSubOrder(idParam(req), actorOf(req));
    const tax = invoices.find((i) => i.type === 'TAX_INVOICE');
    if (!tax) throw new NotFoundError('The invoice is issued when the seller ships this sub-order');
    sendPdf(res, tax);
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await InvoiceService.getForUser(idParam(req), actorOf(req)) });
  } catch (err) {
    handleServiceError(err, res);
  }
};

/** Any invoice or credit note as PDF. */
export const downloadInvoicePdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    sendPdf(res, await InvoiceService.getForUser(idParam(req), actorOf(req)));
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Legacy order-level routes ------------------------------------------------------------------

export const getOrderInvoiceData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = idParam(req);
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new NotFoundError('Order not found');
    res.json({ success: true, data: await InvoiceService.listForOrder(orderId, actorOf(req)) });
  } catch (err) {
    handleServiceError(err, res);
  }
};

/** `GET /orders/:id/invoice`: the invoice when the caller can see exactly one; otherwise ask for a sub-order. */
export const downloadOrderInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orderId = idParam(req);
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new NotFoundError('Order not found');
    const taxInvoices = (await InvoiceService.listForOrder(orderId, actorOf(req))).filter(
      (i) => i.type === 'TAX_INVOICE',
    );
    if (taxInvoices.length === 0) throw new NotFoundError('No invoice has been issued for this order yet');
    if (taxInvoices.length > 1) {
      res.status(409).json({
        success: false,
        message: 'This order has one invoice per seller. Download them from the sub-orders.',
        data: taxInvoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, subOrderId: i.subOrderId })),
      });
      return;
    }
    sendPdf(res, taxInvoices[0]);
  } catch (err) {
    handleServiceError(err, res);
  }
};
