import { prisma } from '../../common/lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { INDIAN_STATES, isValidStateCode } from '../gst/states';

/**
 * Every address carries a GST state code: it decides the buyer's place of supply (CGST+SGST vs IGST).
 * Accepts a code, or a state name that is mapped to its code; the stored name always comes from the code.
 */
export function resolveState(input: { stateCode?: string; state?: string }): { stateCode: string; state: string } {
  let code = input.stateCode;
  if (!code && input.state) {
    const wanted = input.state.trim().toLowerCase();
    code = Object.entries(INDIAN_STATES).find(([, name]) => name.toLowerCase() === wanted)?.[0];
  }
  if (!code || !isValidStateCode(code)) throw new BadRequestError('Select a valid Indian state');
  return { stateCode: code, state: INDIAN_STATES[code] };
}

export const AddressService = {
  async create(
    userId: string,
    data: {
      label?: string;
      addressLine1: string;
      addressLine2?: string;
      village?: string;
      city: string;
      district?: string;
      state?: string;
      stateCode?: string;
      pincode: string;
      isDefault?: boolean;
    },
  ) {
    const { isDefault, state: _state, stateCode: _code, ...other } = data;
    const rest = { ...other, ...resolveState(data) };

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: { userId, ...rest, isDefault: isDefault ?? false },
    });
  },

  async list(userId: string, filters: { page: number; limit: number }) {
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [addresses, total] = await Promise.all([
      prisma.address.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.address.count({ where: { userId } }),
    ]);

    return { addresses, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(id: string, userId: string) {
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new NotFoundError('Address not found');
    return address;
  },

  async update(
    id: string,
    userId: string,
    data: {
      label?: string;
      addressLine1?: string;
      addressLine2?: string;
      village?: string;
      city?: string;
      district?: string;
      state?: string;
      stateCode?: string;
      pincode?: string;
      isDefault?: boolean;
    },
  ) {
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new NotFoundError('Address not found');

    const { isDefault, state: _state, stateCode: _code, ...other } = data;
    const rest = { ...other, ...(data.state || data.stateCode ? resolveState(data) : {}) };

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id },
      data: { ...rest, ...(isDefault !== undefined ? { isDefault } : {}) },
    });
  },

  async delete(id: string, userId: string) {
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new NotFoundError('Address not found');
    await prisma.address.delete({ where: { id } });
    return { message: 'Address deleted' };
  },

  async setDefault(id: string, userId: string) {
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address || address.userId !== userId) throw new NotFoundError('Address not found');

    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    return prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
  },
};
