import { injectable } from 'tsyringe';
import { BaseRepository } from '../../common/lib/base.repository';

@injectable()
export class AuthRepository extends BaseRepository {
  // ── User ──────────────────────────────────────────────────────────────────
  findUserByPhone(phoneNumber: string) {
    return this.prisma.user.findUnique({ where: { phoneNumber } });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserByReferralCode(code: string) {
    return this.prisma.user.findUnique({ where: { referralCode: code } });
  }

  createUser(data: {
    fullName: string; phoneNumber: string; email?: string;
    passwordHash: string; role: string; referralCode: string;
    referredById?: string; languagePref: string; deviceType?: string;
  }) {
    return this.prisma.user.create({ data: data as any });
  }

  updateUser(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  // ── Farmer / Vendor ───────────────────────────────────────────────────────
  createFarmerProfile(userId: string) {
    return this.prisma.farmer.create({ data: { userId } });
  }

  createVendorProfile(userId: string, data: { businessName: string; commissionRate: number }) {
    return this.prisma.vendor.create({ data: { userId, ...data } });
  }

  // ── OTP ───────────────────────────────────────────────────────────────────
  invalidatePreviousOtps(phoneNumber: string) {
    return this.prisma.otpVerification.updateMany({
      where: { phoneNumber, isUsed: false },
      data: { isUsed: true },
    });
  }

  createOtp(data: {
    userId: string; phoneNumber: string; otpHash: string;
    expiresAt: Date; ipAddress?: string;
  }) {
    return this.prisma.otpVerification.create({ data });
  }

  findLatestOtp(phoneNumber: string) {
    return this.prisma.otpVerification.findFirst({
      where: { phoneNumber, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateOtp(id: string, data: any) {
    return this.prisma.otpVerification.update({ where: { id }, data });
  }

  // ── Session ───────────────────────────────────────────────────────────────
  createSession(data: {
    userId: string; refreshToken: string; deviceType?: string;
    ipAddress?: string; userAgent?: string; expiresAt: Date;
  }) {
    return this.prisma.session.create({ data });
  }

  findSession(refreshToken: string) {
    return this.prisma.session.findUnique({ where: { refreshToken } });
  }

  deleteSession(refreshToken: string) {
    return this.prisma.session.deleteMany({ where: { refreshToken } });
  }

  deleteUserSessions(userId: string) {
    return this.prisma.session.deleteMany({ where: { userId } });
  }
}
