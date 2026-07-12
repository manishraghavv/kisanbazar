import { Request, Response } from 'express';
import { container } from '../../common/lib/di';
import { AuthService } from './auth.service';
const authService = container.resolve(AuthService);

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await authService.register({
      ...req.body,
      ip: req.ip,
    });
    res.status(201).json({
      success: true,
      message: 'Registration successful. Verify your phone number with the OTP sent.',
      data,
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await authService.login({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Login successful', data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  await authService.logout(req.body.refreshToken);
  res.json({ success: true, message: 'Logged out successfully' });
};

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await authService.refreshToken(req.body.refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    await authService.verifyOtp(req.body.phoneNumber, req.body.otp);
    res.json({ success: true, message: 'Phone number verified successfully' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    await authService.resendOtp(req.body.phoneNumber, req.ip);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  await authService.forgotPassword(req.body.phoneNumber, req.ip);
  res.json({ success: true, message: 'If this number is registered, an OTP has been sent.' });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    await authService.resetPassword(req.body.phoneNumber, req.body.otp, req.body.newPassword);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    handleServiceError(err, res);
  }
};
