import { injectable } from 'tsyringe';
import { BaseRepository } from '../../common/lib/base.repository';

@injectable()
export class UserRepository extends BaseRepository {
  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id, deletedAt: null } });
  }

  updateUser(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
  }

  listUsers(params: { skip: number; take: number; where: any }) {
    return this.prisma.user.findMany({
      where: params.where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  countUsers(where: any) {
    return this.prisma.user.count({ where });
  }

  findFarmer(userId: string) {
    return this.prisma.farmer.findUnique({ where: { userId } });
  }

  findVendor(userId: string) {
    return this.prisma.vendor.findUnique({ where: { userId } });
  }

  updateFarmer(userId: string, data: any) {
    return this.prisma.farmer.update({ where: { userId }, data });
  }

  updateVendor(userId: string, data: any) {
    return this.prisma.vendor.update({ where: { userId }, data });
  }

  findUserByEmail(email: string, excludeId: string) {
    return this.prisma.user.findFirst({ where: { email, NOT: { id: excludeId } } });
  }
}
