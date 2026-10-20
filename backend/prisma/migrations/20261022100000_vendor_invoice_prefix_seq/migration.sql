-- Source of the short per-vendor invoice series prefix ("V001", "V002", ...). A prefix is assigned the first time a
-- vendor's first invoice is issued and never changes afterwards, so invoice numbers stay unique and gapless per vendor.
CREATE SEQUENCE IF NOT EXISTS "vendor_invoice_prefix_seq";
