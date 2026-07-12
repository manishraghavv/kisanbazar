import { injectable } from 'tsyringe';
import { BaseRepository } from '../../common/lib/base.repository';

@injectable()
export class KhataRepository extends BaseRepository {
  // ── Accounts ──────────────────────────────────────────────────────────────
  createAccount(data: any) {
    return this.prisma.khataAccount.create({ data, include: { vendor: { select: { businessName: true } }, farmer: { select: { user: { select: { fullName: true, phoneNumber: true } } } } } });
  }

  findAccountById(id: string, include?: any) {
    return this.prisma.khataAccount.findUnique({ where: { id }, ...(include ? { include } : {}) });
  }

  findAccountByVendorFarmer(vendorId: string, farmerId: string) {
    return this.prisma.khataAccount.findUnique({ where: { vendorId_farmerId: { vendorId, farmerId } } });
  }

  listAccounts(where: any, skip: number, take: number) {
    return this.prisma.khataAccount.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' }, include: { vendor: { select: { businessName: true } }, farmer: { select: { user: { select: { fullName: true, phoneNumber: true } } } } } });
  }

  countAccounts(where: any) {
    return this.prisma.khataAccount.count({ where });
  }

  updateAccount(id: string, data: any) {
    return this.prisma.khataAccount.update({ where: { id }, data });
  }

  // ── Transactions ──────────────────────────────────────────────────────────
  createTransaction(data: any) {
    return this.prisma.khataTransaction.create({ data });
  }

  listTransactions(where: any, skip: number, take: number) {
    return this.prisma.khataTransaction.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } });
  }

  countTransactions(where: any) {
    return this.prisma.khataTransaction.count({ where });
  }

  // ── Requests ──────────────────────────────────────────────────────────────
  createRequest(data: any) {
    return this.prisma.khataRequest.create({ data });
  }

  findRequestById(id: string) {
    return this.prisma.khataRequest.findUnique({ where: { id }, include: { khataAccount: { include: { vendor: { select: { userId: true } } } } } });
  }

  findPendingRequest(accountId: string) {
    return this.prisma.khataRequest.findFirst({ where: { khataAccountId: accountId, status: 'PENDING' } });
  }

  updateRequest(id: string, data: any) {
    return this.prisma.khataRequest.update({ where: { id }, data });
  }

  // ── Statements ────────────────────────────────────────────────────────────
  listStatements(accountId: string) {
    return this.prisma.khataStatement.findMany({ where: { khataAccountId: accountId }, orderBy: { periodStart: 'desc' } });
  }

  findStatementById(accountId: string, statementId: string) {
    return this.prisma.khataStatement.findFirst({ where: { id: statementId, khataAccountId: accountId } });
  }

  createStatement(data: any) {
    return this.prisma.khataStatement.create({ data });
  }

  findLastTransactionBefore(accountId: string, date: Date) {
    return this.prisma.khataTransaction.findFirst({
      where: { khataAccountId: accountId, createdAt: { lt: date } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listTransactionsInRange(accountId: string, start: Date, end: Date) {
    return this.prisma.khataTransaction.findMany({
      where: { khataAccountId: accountId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
