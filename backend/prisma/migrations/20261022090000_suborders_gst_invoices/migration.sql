-- Phase 3: sub-orders per vendor, GST (state codes, CGST/SGST/IGST), invoices + credit notes, returns, coupon usage.
-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "stateCode" VARCHAR(2);

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "cgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hsnCode" TEXT,
ADD COLUMN     "igstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subOrderId" TEXT,
ADD COLUMN     "taxableValue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_status_history" ADD COLUMN     "subOrderId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "placeOfSupply" VARCHAR(2),
ADD COLUMN     "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxableValue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" DECIMAL(12,2),
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "restock" BOOLEAN,
ADD COLUMN     "subOrderId" TEXT,
ADD COLUMN     "vendorNote" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "subOrderId" TEXT;

-- AlterTable
ALTER TABLE "vendor_commissions" ADD COLUMN     "subOrderId" TEXT;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "invoicePrefix" TEXT,
ADD COLUMN     "stateCode" VARCHAR(2);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "subOrderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "placeOfSupply" VARCHAR(2),
    "sellerStateCode" VARCHAR(2),
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryCharge" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "khataAccountId" TEXT,
    "cancellationReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalInvoiceId" TEXT,
    "returnId" TEXT,
    "sellerName" TEXT NOT NULL,
    "sellerGstin" TEXT,
    "sellerStateCode" TEXT NOT NULL,
    "sellerAddress" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "placeOfSupply" TEXT NOT NULL,
    "isInterState" BOOLEAN NOT NULL,
    "taxableValue" DECIMAL(12,2) NOT NULL,
    "cgstAmount" DECIMAL(12,2) NOT NULL,
    "sgstAmount" DECIMAL(12,2) NOT NULL,
    "igstAmount" DECIMAL(12,2) NOT NULL,
    "deliveryCharge" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "lines" JSONB NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "vendorId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("vendorId","financialYear","series")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_orderId_key" ON "coupon_usages"("orderId");

-- CreateIndex
CREATE INDEX "coupon_usages_couponId_idx" ON "coupon_usages"("couponId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_couponId_userId_seq_key" ON "coupon_usages"("couponId", "userId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "sub_orders_subOrderNumber_key" ON "sub_orders"("subOrderNumber");

-- CreateIndex
CREATE INDEX "sub_orders_vendorId_status_idx" ON "sub_orders"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sub_orders_orderId_vendorId_key" ON "sub_orders"("orderId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_uniqueKey_key" ON "invoices"("uniqueKey");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_returnId_key" ON "invoices"("returnId");

-- CreateIndex
CREATE INDEX "invoices_subOrderId_idx" ON "invoices"("subOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_vendorId_type_financialYear_seq_key" ON "invoices"("vendorId", "type", "financialYear", "seq");

-- CreateIndex
CREATE INDEX "return_items_returnId_idx" ON "return_items"("returnId");

-- CreateIndex
CREATE INDEX "return_items_orderItemId_idx" ON "return_items"("orderItemId");

-- CreateIndex
CREATE INDEX "coupons_vendorId_idx" ON "coupons"("vendorId");

-- CreateIndex
CREATE INDEX "order_items_subOrderId_idx" ON "order_items"("subOrderId");

-- CreateIndex
CREATE INDEX "order_status_history_subOrderId_idx" ON "order_status_history"("subOrderId");

-- CreateIndex
CREATE INDEX "shipments_subOrderId_idx" ON "shipments"("subOrderId");

-- CreateIndex
CREATE INDEX "vendor_commissions_subOrderId_idx" ON "vendor_commissions"("subOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_invoicePrefix_key" ON "vendors"("invoicePrefix");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_commissions" ADD CONSTRAINT "vendor_commissions_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 3 backfill (data written before sub-orders existed)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Address state codes from the free-text state name (unmatched rows stay NULL and must be re-entered).
UPDATE "addresses" a SET "stateCode" = m.code
FROM (VALUES
    ('01', 'jammu and kashmir'),
    ('02', 'himachal pradesh'),
    ('03', 'punjab'),
    ('04', 'chandigarh'),
    ('05', 'uttarakhand'),
    ('06', 'haryana'),
    ('07', 'delhi'),
    ('08', 'rajasthan'),
    ('09', 'uttar pradesh'),
    ('10', 'bihar'),
    ('11', 'sikkim'),
    ('12', 'arunachal pradesh'),
    ('13', 'nagaland'),
    ('14', 'manipur'),
    ('15', 'mizoram'),
    ('16', 'tripura'),
    ('17', 'meghalaya'),
    ('18', 'assam'),
    ('19', 'west bengal'),
    ('20', 'jharkhand'),
    ('21', 'odisha'),
    ('21', 'orissa'),
    ('22', 'chhattisgarh'),
    ('23', 'madhya pradesh'),
    ('24', 'gujarat'),
    ('26', 'dadra and nagar haveli and daman and diu'),
    ('27', 'maharashtra'),
    ('29', 'karnataka'),
    ('30', 'goa'),
    ('31', 'lakshadweep'),
    ('32', 'kerala'),
    ('33', 'tamil nadu'),
    ('34', 'puducherry'),
    ('34', 'pondicherry'),
    ('35', 'andaman and nicobar islands'),
    ('36', 'telangana'),
    ('37', 'andhra pradesh'),
    ('38', 'ladakh'),
    ('07', 'new delhi'),
    ('97', 'other territory')
) AS m(code, name)
WHERE a."stateCode" IS NULL AND lower(btrim(a."state")) = m.name;

-- 2. Vendor state from the GSTIN prefix when the GSTIN is present and well-formed.
UPDATE "vendors" SET "stateCode" = left("gstNumber", 2)
WHERE "stateCode" IS NULL AND "gstNumber" ~ '^(0[1-9]|1[0-9]|2[0-4]|2[67]|29|3[0-8]|97)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$';

-- 3. Order-level GST context.
UPDATE "orders" o SET "placeOfSupply" = a."stateCode", "taxableValue" = GREATEST(o."subtotal" - o."discountAmount", 0)
FROM "addresses" a WHERE a."id" = o."addressId";

-- 4. One sub-order per (order, vendor). Every pre-existing single-vendor order gets exactly one. Orders that mixed
--    vendors are split by vendor; their delivery charge and discount are shared in proportion to each vendor's
--    subtotal (a paisa of rounding drift against the parent order total is possible for those legacy orders).
--    Legacy sub-orders carry no CGST/SGST/IGST split (the state context did not exist); gstAmount holds the tax.
WITH per_vendor AS (
  SELECT oi."orderId", p."vendorId",
         SUM(oi."unitPrice" * oi."quantity") AS subtotal,
         SUM(oi."unitPrice" * oi."quantity" * oi."gstRate" / 100) AS gst
  FROM "order_items" oi
  JOIN "product_variants" v ON v."id" = oi."variantId"
  JOIN "products" p ON p."id" = v."productId"
  GROUP BY oi."orderId", p."vendorId"
), numbered AS (
  SELECT pv.*, o."orderNumber", o."status", o."createdAt", o."placeOfSupply",
         o."deliveryCharge" AS o_delivery, o."discountAmount" AS o_discount, o."subtotal" AS o_subtotal,
         ROW_NUMBER() OVER (PARTITION BY pv."orderId" ORDER BY pv."vendorId") AS n,
         COUNT(*) OVER (PARTITION BY pv."orderId") AS cnt
  FROM per_vendor pv JOIN "orders" o ON o."id" = pv."orderId"
), shares AS (
  SELECT numbered.*,
         CASE WHEN cnt = 1 THEN o_discount ELSE ROUND(o_discount * subtotal / NULLIF(o_subtotal, 0), 2) END AS disc,
         CASE WHEN cnt = 1 THEN o_delivery ELSE ROUND(o_delivery * subtotal / NULLIF(o_subtotal, 0), 2) END AS deliv
  FROM numbered
)
INSERT INTO "sub_orders" ("id", "orderId", "vendorId", "subOrderNumber", "status", "placeOfSupply", "subtotal",
                          "discountAmount", "taxableValue", "gstAmount", "deliveryCharge", "totalAmount", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "orderId", "vendorId", "orderNumber" || '-' || n, "status", "placeOfSupply",
       ROUND(subtotal, 2), COALESCE(disc, 0), ROUND(subtotal, 2) - COALESCE(disc, 0), ROUND(gst, 2), COALESCE(deliv, 0),
       ROUND(subtotal, 2) - COALESCE(disc, 0) + ROUND(gst, 2) + COALESCE(deliv, 0), "createdAt", now()
FROM shares;

UPDATE "sub_orders" so SET "deliveredAt" = (
  SELECT MAX(h."changedAt") FROM "order_status_history" h WHERE h."orderId" = so."orderId" AND h."newStatus" = 'DELIVERED'
) WHERE so."status" IN ('DELIVERED', 'RETURNED', 'REFUNDED');

-- 5. Link the existing rows.
UPDATE "order_items" oi SET "subOrderId" = so."id", "taxableValue" = ROUND(oi."unitPrice" * oi."quantity", 2)
FROM "sub_orders" so, "product_variants" v, "products" p
WHERE oi."variantId" = v."id" AND v."productId" = p."id" AND so."orderId" = oi."orderId" AND so."vendorId" = p."vendorId";

UPDATE "vendor_commissions" vc SET "subOrderId" = so."id"
FROM "sub_orders" so WHERE so."orderId" = vc."orderId" AND so."vendorId" = vc."vendorId";

UPDATE "shipments" s SET "subOrderId" = (
  SELECT so."id" FROM "sub_orders" so WHERE so."orderId" = s."orderId" ORDER BY so."subOrderNumber" LIMIT 1
);

UPDATE "returns" r SET "subOrderId" = (
  SELECT so."id" FROM "sub_orders" so WHERE so."orderId" = r."orderId" ORDER BY so."subOrderNumber" LIMIT 1
);

-- 6. The links are now mandatory. Fail loudly (instead of leaving orphans) if anything could not be linked.
DO $$
DECLARE orphans INTEGER;
BEGIN
  SELECT (SELECT COUNT(*) FROM "order_items" WHERE "subOrderId" IS NULL)
       + (SELECT COUNT(*) FROM "shipments" WHERE "subOrderId" IS NULL)
       + (SELECT COUNT(*) FROM "vendor_commissions" WHERE "subOrderId" IS NULL) INTO orphans;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Phase 3 backfill left % rows without a sub-order; fix the data and re-run', orphans;
  END IF;
END $$;

ALTER TABLE "order_items" ALTER COLUMN "subOrderId" SET NOT NULL;
ALTER TABLE "shipments" ALTER COLUMN "subOrderId" SET NOT NULL;
ALTER TABLE "vendor_commissions" ALTER COLUMN "subOrderId" SET NOT NULL;
