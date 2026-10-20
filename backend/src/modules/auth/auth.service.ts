import crypto from 'crypto';
import { prisma } from "../../common/lib/prisma";
import { hashPassword, comparePassword } from '../../common/utils/passwordUtils';
import { getUserAuthStatus, isAccessAllowed } from '../../common/lib/userAuthState';
import { logOtpForDev } from '../../common/utils/otpLog';
import { generateAccessToken, generateRefreshToken, verifyToken, getRefreshSecret } from '../../common/utils/jwtUtils';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  TooManyRequestsError,
} from '../../common/errors';
import { UserRole } from '@prisma/client';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export interface RegisterInput {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  role: string;
  referralCode?: string;
  languagePref?: string;
  deviceType?: string;
  ip?: string;
}

export interface LoginInput {
  phoneNumber: string;
  password: string;
  deviceType?: string;
  ip?: string;
  userAgent?: string;
}

export class AuthService {
  async register(input: RegisterInput) {
    const { fullName, phoneNumber, email, password, role, referralCode, languagePref, deviceType, ip } = input;

    const existing = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existing) throw new ConflictError('Phone number already registered');

    if (email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) throw new ConflictError('Email already registered');
    }

    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) referredById = referrer.id;
    }

    const passwordHash = await hashPassword(password);
    const newReferralCode = generateReferralCode();

    const user = await prisma.user.create({
      data: {
        fullName,
        phoneNumber,
        email,
        passwordHash,
        role: role as UserRole,
        referralCode: newReferralCode,
        referredById,
        languagePref: languagePref ?? 'hi',
        deviceType,
      },
    });

    if (role === 'FARMER') {
      await prisma.farmer.create({ data: { userId: user.id } });
    } else if (role === 'VENDOR') {
      await prisma.vendor.create({
        data: { userId: user.id, businessName: fullName, commissionRate: 10 },
      });
    }

    await this.sendOtp(user.id, phoneNumber, ip);

    return { userId: user.id, phoneNumber: user.phoneNumber, role: user.role };
  }

  async login(input: LoginInput) {
    const { phoneNumber, password, deviceType, ip, userAgent } = input;

    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid credentials');
    if (user.status === 'DELETED' || user.status === 'BLOCKED')
      throw new ForbiddenError('Account is not accessible');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        deviceType: deviceType ?? user.deviceType,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        role: user.role,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
  }

  async refreshToken(refreshToken: string) {
    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedError('Invalid or expired refresh token');

    const payload = verifyToken(refreshToken, getRefreshSecret());
    if (!payload) throw new UnauthorizedError('Invalid refresh token');
    if (!isAccessAllowed(await getUserAuthStatus(payload.userId))) throw new UnauthorizedError('Account is not active');

    return { accessToken: generateAccessToken({ userId: payload.userId, role: payload.role }) };
  }

  async sendOtp(userId: string, phoneNumber: string, ip?: string) {
    // Invalidate existing unused OTPs
    await prisma.otpVerification.updateMany({
      where: { phoneNumber, isUsed: false },
      data: { isUsed: true },
    });

    const otp = generateOtp();
    const otpHash = await hashPassword(otp);

    await prisma.otpVerification.create({
      data: {
        userId,
        phoneNumber,
        otpHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        ipAddress: ip,
      },
    });

    // Enqueue SMS job via BullMQ if SMS is enabled, otherwise log
    if (process.env.SMS_ENABLED === 'true') {
      const { JobQueue } = await import('../../jobs/queues');
      await JobQueue.sms({ to: phoneNumber, message: `Your OTP is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`, templateName: 'OTP' });
    } else {
      logOtpForDev(phoneNumber, otp);
    }
  }

  async verifyOtp(phoneNumber: string, otp: string) {
    const record = await prisma.otpVerification.findFirst({
      where: { phoneNumber, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new BadRequestError('OTP expired or not found');
    if (record.attempts >= MAX_OTP_ATTEMPTS)
      throw new TooManyRequestsError('Too many attempts. Request a new OTP.');

    const valid = await comparePassword(otp, record.otpHash);
    if (!valid) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestError('Invalid OTP');
    }

    await prisma.otpVerification.update({ where: { id: record.id }, data: { isUsed: true } });

    if (record.userId) {
      await prisma.user.update({ where: { id: record.userId }, data: { isPhoneVerified: true } });
    }
  }

  async resendOtp(phoneNumber: string, ip?: string) {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) throw new NotFoundError('User not found');
    await this.sendOtp(user.id, phoneNumber, ip);
  }

  async forgotPassword(phoneNumber: string, ip?: string) {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (user) {
      await this.sendOtp(user.id, phoneNumber, ip);
    }
    // Always return success to prevent user enumeration
  }

  async resetPassword(phoneNumber: string, otp: string, newPassword: string) {
    const record = await prisma.otpVerification.findFirst({
      where: { phoneNumber, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new BadRequestError('OTP expired or not found');
    if (record.attempts >= MAX_OTP_ATTEMPTS)
      throw new TooManyRequestsError('Too many attempts. Request a new OTP.');

    const valid = await comparePassword(otp, record.otpHash);
    if (!valid) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestError('Invalid OTP');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { phoneNumber }, data: { passwordHash } });
    await prisma.otpVerification.update({ where: { id: record.id }, data: { isUsed: true } });

    if (record.userId) {
      await prisma.session.deleteMany({ where: { userId: record.userId } });
    }
  }
}