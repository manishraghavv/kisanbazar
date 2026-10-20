import { comparePassword } from '../../common/utils/passwordUtils';
import { revokeUserAccess } from '../../common/lib/userAuthState';
import { prisma } from '../../common/lib/prisma';
import { NotFoundError, ConflictError, UnauthorizedError } from '../../common/errors';
import { UserRole, UserStatus } from '@prisma/client';
import { stateCodeFromGstin } from '../gst/states';

export interface UpdateProfileInput {
  fullName?: string;
  email?: string;
  languagePref?: string;
  deviceType?: string;
}

export interface UpdateFarmerInput {
  village?: string;
  district?: string;
  state?: string;
  pincode?: string;
  landAreaAcres?: number;
  primaryCrops?: string[];
}

export interface UpdateVendorInput {
  businessName?: string;
  gstNumber?: string;
  panNumber?: string;
  stateCode?: string;
  businessAddress?: string;
}

export interface AdminUpdateUserInput {
  fullName?: string;
  email?: string;
  status?: string;
  role?: string;
}

export interface ListUsersFilter {
  page: number;
  limit: number;
  role?: string;
  status?: string;
  search?: string;
}

export class UserService {
  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
        isPhoneVerified: true,
        isEmailVerified: true,
        languagePref: true,
        deviceType: true,
        referralCode: true,
        createdAt: true,
        lastLoginAt: true,
        farmerProfile: true,
        vendorProfile: {
          select: {
            id: true,
            businessName: true,
            gstNumber: true,
            panNumber: true,
            kycStatus: true,
            commissionRate: true,
            tier: true,
            isFeatures: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const { fullName, email, languagePref, deviceType } = input;

    if (email) {
      const emailExists = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (emailExists) throw new ConflictError('Email already in use');
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName && { fullName }),
        ...(email && { email }),
        ...(languagePref && { languagePref }),
        ...(deviceType && { deviceType }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        languagePref: true,
        deviceType: true,
      },
    });
  }

  async list(filter: ListUsersFilter) {
    const { page, limit, role, status, search } = filter;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(role && { role: role as UserRole }),
      ...(status && { status: status as UserStatus }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { phoneNumber: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          role: true,
          status: true,
          isPhoneVerified: true,
          createdAt: true,
          lastLoginAt: true,
          farmerProfile: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async adminUpdate(id: string, input: AdminUpdateUserInput) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundError('User not found');

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName && { fullName: input.fullName }),
        ...(input.email && { email: input.email }),
        ...(input.status && { status: input.status as UserStatus }),
        ...(input.role && { role: input.role as UserRole }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
      },
    });
    await revokeUserAccess(id, updated.status);
    return updated;
  }

  async softDelete(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundError('User not found');

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    await revokeUserAccess(id, 'DELETED');
  }

  async updateFarmerProfile(userId: string, input: UpdateFarmerInput) {
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (!farmer) throw new NotFoundError('Farmer profile not found');

    return prisma.farmer.update({
      where: { userId },
      data: {
        ...(input.village !== undefined && { village: input.village }),
        ...(input.district !== undefined && { district: input.district }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.pincode !== undefined && { pincode: input.pincode }),
        ...(input.landAreaAcres !== undefined && { landAreaAcres: input.landAreaAcres }),
        ...(input.primaryCrops !== undefined && { primaryCrops: input.primaryCrops }),
      },
    });
  }

  async updateVendorProfile(userId: string, input: UpdateVendorInput) {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) throw new NotFoundError('Vendor profile not found');

    return prisma.vendor.update({
      where: { userId },
      data: {
        ...(input.businessName && { businessName: input.businessName }),
        ...(input.gstNumber && { gstNumber: input.gstNumber }),
        ...(input.panNumber && { panNumber: input.panNumber }),
        // The seller's GST state: explicit, else taken from the GSTIN prefix.
        ...((input.stateCode || input.gstNumber) && {
          stateCode: input.stateCode ?? stateCodeFromGstin(input.gstNumber!),
        }),
        ...(input.businessAddress && { businessAddress: input.businessAddress }),
      },
      select: {
        id: true,
        businessName: true,
        gstNumber: true,
        panNumber: true,
        stateCode: true,
        businessAddress: true,
        kycStatus: true,
        commissionRate: true,
        tier: true,
      },
    });
  }

  // ── Phone Change ──────────────────────────────────────────────────────────
  async changePhone(userId: string, newPhone: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    // Verify current password
    const valid = await comparePassword(password, user.passwordHash!);
    if (!valid) throw new UnauthorizedError('Invalid password');

    // Check new phone not taken
    const existing = await prisma.user.findUnique({ where: { phoneNumber: newPhone } });
    if (existing) throw new ConflictError('Phone number already in use');

    await prisma.user.update({
      where: { id: userId },
      data: { phoneNumber: newPhone, isPhoneVerified: false },
    });

    return { message: 'Phone number updated. Please verify with OTP.' };
  }

  // ── Self-Delete ───────────────────────────────────────────────────────────
  async selfDelete(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const valid = await comparePassword(password, user.passwordHash!);
    if (!valid) throw new UnauthorizedError('Invalid password');

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    await revokeUserAccess(userId, 'DELETED');

    return { message: 'Account deleted successfully' };
  }

  // ── Admin Status Update ───────────────────────────────────────────────────
  async adminUpdateStatus(id: string, status: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundError('User not found');

    const updated = await prisma.user.update({
      where: { id },
      data: { status: status as UserStatus },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
      },
    });
    await revokeUserAccess(id, updated.status);
    return updated;
  }
}
