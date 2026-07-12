import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import {
  runInterestCalculation,
  runOverdueEscalation,
  runCartCleanup,
  runRepaymentReminders,
  runPriceAlerts,
  getCronStatus,
} from '../../jobs/cron';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

// ── Admin Manual Triggers ────────────────────────────────────────────────────

export const triggerInterestCalculation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await runInterestCalculation();
    res.json({
      success: true,
      message: `Interest calculation completed. ${result.processed} accounts processed.`,
      data: result,
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const triggerOverdueEscalation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await runOverdueEscalation();
    res.json({
      success: true,
      message: `Overdue escalation completed. ${result.markedOverdue} marked overdue, ${result.escalated} escalated, ${result.suspended} suspended.`,
      data: result,
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const triggerCartCleanup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await runCartCleanup();
    res.json({
      success: true,
      message: `Cart cleanup completed. ${result.deletedCarts} carts deleted, ${result.releasedStock} stock released.`,
      data: result,
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const triggerPriceAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await runPriceAlerts();
    res.json({
      success: true,
      message: `Price alerts completed. ${result.alertsSent} alerts sent.`,
      data: result,
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const triggerRepaymentReminders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await runRepaymentReminders();
    res.json({
      success: true,
      message: `Repayment reminders completed. ${result.remindersSent} notifications sent.`,
      data: result,
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getCronStatusController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = getCronStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    handleServiceError(err, res);
  }
};
