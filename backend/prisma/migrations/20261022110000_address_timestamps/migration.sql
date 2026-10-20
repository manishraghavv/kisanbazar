-- addresses had no timestamps although the API lists them newest-first (orderBy createdAt), which made
-- GET /api/addresses fail with a 500 on every call. Existing rows get "now" as their creation time.
ALTER TABLE "addresses" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "addresses" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "addresses" ALTER COLUMN "updatedAt" DROP DEFAULT;
