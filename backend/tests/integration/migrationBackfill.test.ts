import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { TEST_DATABASE_URL } from '../testEnv';

/**
 * The Phase 3 migration backfills sub-orders for orders that existed before sub-orders did. This test builds a scratch
 * database at the previous migration, inserts "legacy" orders (one single-vendor, one that mixed two vendors),
 * applies the Phase 3 migration, and checks the result. The scratch database is dropped afterwards.
 */

const MIGRATIONS = path.resolve(__dirname, '../../prisma/migrations');
const PHASE3 = '20261022090000_suborders_gst_invoices';

function adminUrl(): { base: URL; dbName: string } {
  const base = new URL(TEST_DATABASE_URL.replace(/^postgres(ql)?:/, 'http:'));
  return { base, dbName: `mig_backfill_${randomBytes(4).toString('hex')}` };
}

const urlFor = (base: URL, db: string) =>
  `postgresql://${base.username}:${base.password}@${base.hostname}:${base.port}/${db}`;

describe('Phase 3 migration backfill', () => {
  const { base, dbName } = adminUrl();
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: urlFor(base, 'postgres') });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    db = new Client({ connectionString: urlFor(base, dbName) });
    await db.connect();

    const dirs = fs
      .readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      if (dir >= PHASE3) break; // everything BEFORE the Phase 3 migration
      await db.query(fs.readFileSync(path.join(MIGRATIONS, dir, 'migration.sql'), 'utf8'));
    }

    await db.query(`
      SET session_replication_role = replica;
      INSERT INTO addresses(id,"userId","addressLine1",city,state,pincode) VALUES ('ad1','u1','x','c','Uttar Pradesh','250001'),('ad2','u1','x','c','Atlantis','250001');
      INSERT INTO vendors(id,"userId","businessName","gstNumber","commissionRate","updatedAt") VALUES
        ('vA','uA','A','09AAAAA0000A1Z5',10,now()), ('vB','uB','B',NULL,10,now());
      INSERT INTO products(id,"vendorId","categoryId",name,slug,"updatedAt") VALUES ('pA','vA','c','A','a',now()),('pB','vB','c','B','b',now());
      INSERT INTO product_variants(id,"productId",sku,mrp,"sellingPrice","updatedAt") VALUES ('xA','pA','sa',1,1,now()),('xB','pB','sb',1,1,now());
      -- single-vendor delivered order with a discount
      INSERT INTO orders(id,"orderNumber","userId","addressId",subtotal,"gstAmount","deliveryCharge","discountAmount","totalAmount",status,"paymentMethod","updatedAt")
        VALUES ('o1','KB-2026-000001','u1','ad1',200,10,40,20,230,'DELIVERED','COD',now());
      INSERT INTO order_items(id,"orderId","variantId",quantity,"unitPrice","gstRate") VALUES ('i1','o1','xA',2,100,5);
      INSERT INTO order_status_history(id,"orderId","newStatus","changedAt") VALUES ('h1','o1','DELIVERED','2026-03-01T10:00:00Z');
      INSERT INTO vendor_commissions(id,"vendorId","orderId","commissionRate","grossAmount","commissionAmount","netAmount") VALUES ('c1','vA','o1',10,200,20,180);
      INSERT INTO shipments(id,"orderId","updatedAt") VALUES ('s1','o1',now());
      INSERT INTO returns(id,"orderId",reason) VALUES ('r1','o1','legacy return');
      -- two-vendor legacy order, unmatched state name
      INSERT INTO orders(id,"orderNumber","userId","addressId",subtotal,"gstAmount","deliveryCharge","discountAmount","totalAmount",status,"paymentMethod","updatedAt")
        VALUES ('o2','KB-2026-000002','u1','ad2',400,20,40,40,420,'CONFIRMED','COD',now());
      INSERT INTO order_items(id,"orderId","variantId",quantity,"unitPrice","gstRate") VALUES ('i2','o2','xA',1,100,5),('i3','o2','xB',1,300,5);
      INSERT INTO vendor_commissions(id,"vendorId","orderId","commissionRate","grossAmount","commissionAmount","netAmount") VALUES ('c2','vA','o2',10,100,10,90),('c3','vB','o2',10,300,30,270);
      SET session_replication_role = DEFAULT;
    `);

    await db.query(fs.readFileSync(path.join(MIGRATIONS, PHASE3, 'migration.sql'), 'utf8'));
  }, 120_000);

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin?.end();
  });

  it('gives every single-vendor order exactly one sub-order carrying its totals', async () => {
    const { rows } = await db.query(`SELECT * FROM sub_orders WHERE "orderId" = 'o1'`);
    expect(rows).toHaveLength(1);
    const so = rows[0];
    expect(so.subOrderNumber).toBe('KB-2026-000001-1');
    expect(so.vendorId).toBe('vA');
    expect(so.status).toBe('DELIVERED');
    expect([so.subtotal, so.discountAmount, so.taxableValue, so.gstAmount, so.deliveryCharge, so.totalAmount]).toEqual([
      '200.00',
      '20.00',
      '180.00',
      '10.00',
      '40.00',
      '230.00',
    ]);
    expect(so.deliveredAt).not.toBeNull();
    expect(so.placeOfSupply).toBe('09'); // from the address state name
  });

  it('splits an order that mixed vendors into one sub-order per vendor whose totals add up to the order', async () => {
    const { rows } = await db.query(`SELECT * FROM sub_orders WHERE "orderId" = 'o2' ORDER BY "subOrderNumber"`);
    expect(rows.map((r) => r.vendorId)).toEqual(['vA', 'vB']);
    const total = rows.reduce((a, r) => a + Number(r.totalAmount), 0);
    expect(total).toBeCloseTo(420, 2);
    expect(rows[0].placeOfSupply).toBeNull(); // 'Atlantis' did not match a state: left NULL, not guessed
  });

  it('links items, commissions, shipments and returns, and makes the links mandatory', async () => {
    const orphans = await db.query(`
      SELECT (SELECT COUNT(*) FROM order_items WHERE "subOrderId" IS NULL) AS items,
             (SELECT COUNT(*) FROM vendor_commissions WHERE "subOrderId" IS NULL) AS commissions,
             (SELECT COUNT(*) FROM shipments WHERE "subOrderId" IS NULL) AS shipments`);
    expect(orphans.rows[0]).toEqual({ items: '0', commissions: '0', shipments: '0' });
    const ret = await db.query(`SELECT "subOrderId" FROM returns WHERE id = 'r1'`);
    expect(ret.rows[0].subOrderId).not.toBeNull();
    const nullable = await db.query(
      `SELECT table_name, is_nullable FROM information_schema.columns WHERE column_name = 'subOrderId' AND table_name IN ('order_items','shipments','vendor_commissions')`,
    );
    expect(nullable.rows.every((r) => r.is_nullable === 'NO')).toBe(true);
    const vc = await db.query(
      `SELECT vc."vendorId" = so."vendorId" AS same FROM vendor_commissions vc JOIN sub_orders so ON so.id = vc."subOrderId"`,
    );
    expect(vc.rows.every((r) => r.same)).toBe(true);
  });

  it('fills vendor and address state codes where they can be derived', async () => {
    const vendors = await db.query(`SELECT id, "stateCode" FROM vendors ORDER BY id`);
    expect(vendors.rows).toEqual([
      { id: 'vA', stateCode: '09' }, // from the GSTIN prefix
      { id: 'vB', stateCode: null }, // no GSTIN: left for the vendor to set
    ]);
    const addresses = await db.query(`SELECT id, "stateCode" FROM addresses ORDER BY id`);
    expect(addresses.rows).toEqual([
      { id: 'ad1', stateCode: '09' },
      { id: 'ad2', stateCode: null },
    ]);
  });
});
