-- Race-free order numbers. The previous "read the last number and add one" approach handed the same number
-- to concurrent checkouts. A sequence never repeats, even across transactions that later roll back.
CREATE SEQUENCE IF NOT EXISTS "order_number_seq";

-- Continue after the highest existing KB-<year>-<seq> number so old and new numbers never collide.
SELECT setval(
  'order_number_seq',
  COALESCE(
    (SELECT MAX(CAST(split_part("orderNumber", '-', 3) AS BIGINT)) FROM "orders" WHERE "orderNumber" ~ '^KB-[0-9]{4}-[0-9]+$'),
    0
  ) + 1,
  false
);
