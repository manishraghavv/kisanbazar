import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { KhataService } from './khata.service';
import { KhataStatus, KhataTransactionType } from '@prisma/client';
import PDFDocument from 'pdfkit';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ── Accounts ────────────────────────────────────────────────────────────────

export const createAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await KhataService.createAccount(req.user.id, req.body.farmerId, {
      creditLimitAmount: req.body.creditLimitAmount,
      interestRatePct: req.body.interestRatePct,
      creditPeriodDays: req.body.creditPeriodDays,
    });
    res.status(201).json({ success: true, message: 'Khata account created', data: account });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.getAccounts(req.user.id, req.user.role, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as KhataStatus | undefined,
      farmerId: req.query.farmerId as string | undefined,
      vendorId: req.query.vendorId as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await KhataService.getAccountById(req.params.id as string, req.user.id, req.user.role);
    res.json({ success: true, data: account });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await KhataService.updateAccount(req.params.id as string, req.user.id, req.user.role, req.body);
    res.json({ success: true, message: 'Khata account updated', data: account });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ── Transactions ─────────────────────────────────────────────────────────────

export const addTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const transaction = await KhataService.addTransaction(req.params.id as string, req.user.id, req.user.role, {
      type: req.body.type as KhataTransactionType,
      amount: req.body.amount,
      linkedOrderId: req.body.linkedOrderId,
      remarks: req.body.remarks,
      proofImageUrl: req.body.proofImageUrl,
      upiTransactionId: req.body.upiTransactionId,
    });
    res.status(201).json({ success: true, message: 'Transaction recorded', data: transaction });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.getTransactions(req.params.id as string, req.user.id, req.user.role, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      type: req.query.type as KhataTransactionType | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ── Credit Requests ────────────────────────────────────────────────────────

export const getRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.getRequests(req.params.id as string, req.user.id, req.user.role, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const createRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await KhataService.createRequest(req.params.id as string, req.user.id, {
      requestedLimit: req.body.requestedLimit,
      reason: req.body.reason,
    });
    res.status(201).json({ success: true, message: 'Credit limit request submitted', data: request });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const reviewRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.reviewRequest(req.params.requestId as string, req.user.id, req.user.role, {
      status: req.body.status,
      reviewNote: req.body.reviewNote,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// ── Statements ───────────────────────────────────────────────────────────────

export const getStatements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const statements = await KhataService.getStatements(req.params.id as string, req.user.id, req.user.role);
    res.json({ success: true, data: statements });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getStatementById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const statement = await KhataService.getStatementById(
      req.params.id as string,
      req.params.statementId as string,
      req.user.id,
      req.user.role,
    );
    res.json({ success: true, data: statement });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const generateStatement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.generateStatement(req.params.id as string, req.user.id, req.user.role, {
      periodStart: new Date(req.body.periodStart),
      periodEnd: new Date(req.body.periodEnd),
    });
    res.status(201).json({ success: true, message: 'Statement generated', data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getAdminKhataOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.getAdminOverview();
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getVendorAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.getVendorAnalytics(req.user.id, req.user.role);
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getOverdueTrends = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.getOverdueTrends(req.user.id, req.user.role);
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getOverdueAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await KhataService.getOverdueAccounts(req.user.id, req.user.role, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      farmerId: req.query.farmerId as string | undefined,
      minDaysOverdue: Number(req.query.minDaysOverdue) || 1,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const generateStatementPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await KhataService.getStatementPdfData(req.params.id as string, req.user.id, req.user.role);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="khata-statement-${req.params.id}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Khata Statement', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
    doc.moveDown(1);

    // Vendor & Farmer Info
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text('Vendor:');
    doc.fontSize(10).font('Helvetica').text(`  ${data.vendor.businessName}`);
    if (data.vendor.gstNumber) doc.text(`  GST: ${data.vendor.gstNumber}`);
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text('Farmer:');
    doc.fontSize(10).font('Helvetica').text(`  ${data.farmer.user.fullName}`);
    doc.text(`  Phone: ${data.farmer.user.phoneNumber}`);
    if (data.farmer.village) doc.text(`  Village: ${data.farmer.village}`);
    doc.moveDown(0.5);

    // Summary
    doc.fontSize(12).font('Helvetica-Bold').text('Account Summary:');
    doc.fontSize(10).font('Helvetica');
    doc.text(`  Outstanding: ₹${data.outstandingAmount}`);
    doc.text(`  Credit Limit: ₹${data.creditLimitAmount}`);
    doc.text(`  Status: ${data.status}`);
    if (data.dueDateNextPayment) {
      doc.text(`  Due Date: ${data.dueDateNextPayment.toLocaleDateString('en-IN')}`);
    }
    doc.moveDown(1);

    // Recent Transactions
    doc.fontSize(12).font('Helvetica-Bold').text('Recent Transactions (last 50):');
    doc.moveDown(0.3);

    if (data.transactions.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#999').text('  No transactions found');
    } else {
      // Table header
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333');
      doc.text('Date         | Type            | Amount       | Balance', { align: 'left' });
      doc.fontSize(9).font('Helvetica').fillColor('#444');
      doc.text('─'.repeat(65));

      for (const tx of data.transactions) {
        const date = tx.createdAt.toLocaleDateString('en-IN');
        const type = tx.type.padEnd(16).slice(0, 16);
        const amount = `₹${tx.amount}`.padStart(12);
        const balance = `₹${tx.balanceAfter}`.padStart(10);
        doc.text(`${date} | ${type} | ${amount} | ${balance}`);
      }
    }

    doc.moveDown(1);
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#999')
      .text('This is a computer-generated statement. No signature required.', { align: 'center' });

    doc.end();
  } catch (err) {
    handleServiceError(err, res);
  }
};
