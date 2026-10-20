-- Money integrity (Phase 2)
--
-- 1. Idempotency keys so ledger writes can be retried safely.
-- 2. CHECK constraints so balances/stock can never go negative, even through a buggy code path.
--
-- Safe to run on a populated database: it never fails because of existing bad rows.
--   * reservedQty was decremented by the old order code without ever being incremented, so negative
--     values are expected in existing data and are reset to 0.
--   * Each constraint is added NOT VALID (enforced for every new write immediately) and VALIDATEd only
--     when no existing row violates it; otherwise a WARNING names the table so it can be repaired by hand.

-- AlterTable
ALTER TABLE "khata_transactions" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "khata_transactions_idempotencyKey_key" ON "khata_transactions"("idempotencyKey");
CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key" ON "wallet_transactions"("idempotencyKey");

-- Backfill: known-bad data from the old reservedQty handling
UPDATE "product_variants" SET "reservedQty" = 0 WHERE "reservedQty" < 0;

-- CHECK constraints (NOT VALID first, then validate when the data allows)
ALTER TABLE "khata_accounts" ADD CONSTRAINT "khata_accounts_outstanding_nonneg" CHECK ("outstandingAmount" >= 0) NOT VALID;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_stock_nonneg" CHECK ("stockQuantity" >= 0) NOT VALID;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_reserved_nonneg" CHECK ("reservedQty" >= 0) NOT VALID;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_nonneg" CHECK ("balance" >= 0) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "khata_accounts" WHERE "outstandingAmount" < 0) THEN
    ALTER TABLE "khata_accounts" VALIDATE CONSTRAINT "khata_accounts_outstanding_nonneg";
  ELSE
    RAISE WARNING 'khata_accounts has negative outstandingAmount rows; constraint left NOT VALID until repaired';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "product_variants" WHERE "stockQuantity" < 0) THEN
    ALTER TABLE "product_variants" VALIDATE CONSTRAINT "product_variants_stock_nonneg";
  ELSE
    RAISE WARNING 'product_variants has negative stockQuantity rows; constraint left NOT VALID until repaired';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "product_variants" WHERE "reservedQty" < 0) THEN
    ALTER TABLE "product_variants" VALIDATE CONSTRAINT "product_variants_reserved_nonneg";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "wallets" WHERE "balance" < 0) THEN
    ALTER TABLE "wallets" VALIDATE CONSTRAINT "wallets_balance_nonneg";
  ELSE
    RAISE WARNING 'wallets has negative balance rows; constraint left NOT VALID until repaired';
  END IF;
END $$;
