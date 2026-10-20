/**
 * Development seed. Idempotent: every record is upserted on a natural unique key, so it is safe to run repeatedly.
 *
 *   npx prisma db seed
 *
 * Passwords come from SEED_*_PASSWORD env vars, falling back to a documented DEV-ONLY default.
 * The script refuses to run when NODE_ENV=production.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { stateName } from '../src/modules/gst/states';

if (process.env.NODE_ENV === 'production') {
  console.error('[seed] Refusing to seed with NODE_ENV=production.');
  process.exit(1);
}

const DEV_DEFAULT_PASSWORD = 'Password@123'; // documented dev-only default
const pw = (name: string) => process.env[`SEED_${name}_PASSWORD`] ?? process.env.SEED_PASSWORD ?? DEV_DEFAULT_PASSWORD;

const pool = new Pool({ connectionString: (process.env.DATABASE_URL ?? '').replace(/\?.*$/, '') });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: 'public' }) });

const D = (v: string | number) => new Prisma.Decimal(v);

async function upsertUser(
  phoneNumber: string,
  fullName: string,
  role: 'ADMIN' | 'VENDOR' | 'FARMER',
  password: string,
  email?: string,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { phoneNumber },
    // Never reset the password of an existing user on re-run.
    update: { fullName, role, status: 'ACTIVE' },
    create: { phoneNumber, fullName, role, passwordHash, email, isPhoneVerified: true, languagePref: 'hi' },
  });
}

async function main() {
  // ── Admin ────────────────────────────────────────────────
  await upsertUser('9000000001', 'Platform Admin', 'ADMIN', pw('ADMIN'), 'admin@example.test');

  // ── Industry + enterprise tier ───────────────────────────
  const industry = await prisma.industry.upsert({
    where: { slug: 'agri-inputs' },
    update: {},
    create: { name: 'Agri Inputs', slug: 'agri-inputs', description: 'Seeds, fertilizers, pesticides and tools' },
  });
  const tier = await prisma.enterpriseTier.upsert({
    where: { name: 'Small' },
    update: {},
    create: {
      name: 'Small',
      size: 'SMALL',
      defaultCommissionRate: D(8),
      maxKhataLimit: D(500000),
      description: 'Seed tier',
    },
  });

  // ── Vendors ──────────────────────────────────────────────
  const vendorDefs = [
    // Three sellers in three different states, so seeded data exercises both GST regimes:
    //   buyer in Uttar Pradesh -> vendor 0 is intra-state (CGST+SGST); vendors 1 and 2 are inter-state (IGST).
    {
      phone: '9000000011',
      name: 'Ramesh Kumar',
      business: 'Kisan Seeds & Fertilizers',
      gst: '09AAAAA0000A1Z5',
      stateCode: '09',
      address: '12 Mandi Road, Meerut, Uttar Pradesh - 250001',
    },
    {
      phone: '9000000012',
      name: 'Sunita Devi',
      business: 'Green Valley Agro Store',
      gst: '27AAPFU0939F1ZV',
      stateCode: '27',
      address: '45 MIDC Industrial Area, Pune, Maharashtra - 411019',
    },
    {
      phone: '9000000013',
      name: 'Anil Gowda',
      business: 'Deccan Irrigation & Tools',
      gst: '29AABCT1332L1ZU',
      stateCode: '29',
      address: '8 Peenya Industrial Estate, Bengaluru, Karnataka - 560058',
    },
  ];
  const vendors = [];
  for (const v of vendorDefs) {
    const user = await upsertUser(v.phone, v.name, 'VENDOR', pw('VENDOR'));
    const vendor = await prisma.vendor.upsert({
      where: { userId: user.id },
      // Keep the GST identity in sync on re-runs (older seeds had no state).
      update: { stateCode: v.stateCode, gstNumber: v.gst, businessAddress: v.address },
      create: {
        userId: user.id,
        businessName: v.business,
        gstNumber: v.gst,
        stateCode: v.stateCode,
        businessAddress: v.address,
        kycStatus: 'APPROVED',
        commissionRate: D(8),
        industryId: industry.id,
        enterpriseTierId: tier.id,
      },
    });
    vendors.push(vendor);
  }

  // ── Farmers ──────────────────────────────────────────────
  const farmerDefs = [
    // Buyers in the same three states as the sellers: the place of supply decides CGST+SGST vs IGST.
    {
      phone: '9000000021',
      name: 'Mohan Singh',
      village: 'Rampur',
      district: 'Meerut',
      crops: ['wheat', 'sugarcane'],
      stateCode: '09',
      city: 'Meerut',
      pincode: '250001',
    },
    {
      phone: '9000000022',
      name: 'Gita Yadav',
      village: 'Kheda',
      district: 'Pune',
      crops: ['rice', 'mustard'],
      stateCode: '27',
      city: 'Pune',
      pincode: '411001',
    },
    {
      phone: '9000000023',
      name: 'Harpreet Gill',
      village: 'Dhuri',
      district: 'Bengaluru Rural',
      crops: ['wheat', 'cotton'],
      stateCode: '29',
      city: 'Bengaluru',
      pincode: '560001',
    },
  ];
  const farmers = [];
  for (const f of farmerDefs) {
    const user = await upsertUser(f.phone, f.name, 'FARMER', pw('FARMER'));
    const farmer = await prisma.farmer.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        village: f.village,
        district: f.district,
        state: stateName(f.stateCode),
        primaryCrops: f.crops,
        landAreaAcres: D(4.5),
      },
    });
    // Dev wallet balance so wallet checkout can be tried straight away.
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, balance: D(5000) },
    });
    // One delivery address per farmer, with its GST state code.
    const hasAddress = await prisma.address.findFirst({ where: { userId: user.id } });
    if (!hasAddress) {
      await prisma.address.create({
        data: {
          userId: user.id,
          label: 'Home (seed)',
          addressLine1: `${f.village} Village`,
          city: f.city,
          district: f.district,
          state: stateName(f.stateCode)!,
          stateCode: f.stateCode,
          pincode: f.pincode,
          isDefault: true,
        },
      });
    } else if (!hasAddress.stateCode) {
      await prisma.address.update({
        where: { id: hasAddress.id },
        data: { stateCode: f.stateCode, state: stateName(f.stateCode)! },
      });
    }
    farmers.push(farmer);
  }

  // ── Categories ───────────────────────────────────────────
  const catDefs = [
    { slug: 'seeds', name: 'Seeds', nameHi: 'बीज' },
    { slug: 'fertilizers', name: 'Fertilizers', nameHi: 'उर्वरक' },
    { slug: 'pesticides', name: 'Pesticides', nameHi: 'कीटनाशक' },
    { slug: 'tools', name: 'Farm Tools', nameHi: 'कृषि उपकरण' },
  ];
  const cats: Record<string, string> = {};
  for (const [i, c] of catDefs.entries()) {
    const cat = await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, sortOrder: i } });
    cats[c.slug] = cat.id;
  }

  // ── Products + variants ──────────────────────────────────
  const productDefs = [
    {
      slug: 'hybrid-wheat-seed',
      name: 'Hybrid Wheat Seed',
      nameHi: 'हाइब्रिड गेहूं बीज',
      cat: 'seeds',
      v: 0,
      hsn: '1001',
      gst: 0,
      unit: 'kg',
      variants: [
        { sku: 'WHEAT-5KG', name: '5 kg bag', mrp: 450, price: 410, stock: 200 },
        { sku: 'WHEAT-20KG', name: '20 kg bag', mrp: 1700, price: 1550, stock: 80 },
      ],
    },
    {
      slug: 'basmati-rice-seed',
      name: 'Basmati Rice Seed',
      nameHi: 'बासमती धान बीज',
      cat: 'seeds',
      v: 0,
      hsn: '1006',
      gst: 0,
      unit: 'kg',
      variants: [{ sku: 'RICE-2KG', name: '2 kg pack', mrp: 380, price: 350, stock: 150 }],
    },
    {
      slug: 'urea-46',
      name: 'Urea 46% N',
      nameHi: 'यूरिया',
      cat: 'fertilizers',
      v: 1,
      hsn: '3102',
      gst: 5,
      unit: 'bag',
      variants: [{ sku: 'UREA-45KG', name: '45 kg bag', mrp: 270, price: 266, stock: 500 }],
    },
    {
      slug: 'dap-fertilizer',
      name: 'DAP Fertilizer',
      nameHi: 'डीएपी खाद',
      cat: 'fertilizers',
      v: 1,
      hsn: '3105',
      gst: 5,
      unit: 'bag',
      variants: [{ sku: 'DAP-50KG', name: '50 kg bag', mrp: 1350, price: 1300, stock: 300 }],
    },
    {
      slug: 'neem-pesticide',
      name: 'Neem Oil Pesticide',
      nameHi: 'नीम तेल कीटनाशक',
      cat: 'pesticides',
      v: 0,
      hsn: '3808',
      gst: 18,
      unit: 'L',
      variants: [
        { sku: 'NEEM-1L', name: '1 L', mrp: 520, price: 480, stock: 120 },
        { sku: 'NEEM-5L', name: '5 L', mrp: 2400, price: 2200, stock: 40 },
      ],
    },
    {
      slug: 'hand-sprayer',
      name: 'Hand Sprayer 16L',
      nameHi: 'हैंड स्प्रेयर',
      cat: 'tools',
      v: 1,
      hsn: '8424',
      gst: 18,
      unit: 'piece',
      variants: [{ sku: 'SPRAYER-16L', name: '16 L knapsack', mrp: 1800, price: 1650, stock: 60 }],
    },
    // Vendor 2 (Karnataka): different GST slabs (12% and 5%) for mixed-rate carts
    {
      slug: 'drip-irrigation-kit',
      name: 'Drip Irrigation Kit (1 acre)',
      nameHi: 'ड्रिप सिंचाई किट',
      cat: 'tools',
      v: 2,
      hsn: '8424',
      gst: 12,
      unit: 'piece',
      variants: [{ sku: 'DRIP-1ACRE', name: '1 acre kit', mrp: 14500, price: 12900, stock: 25 }],
    },
    {
      slug: 'vermicompost',
      name: 'Vermicompost',
      nameHi: 'वर्मी कम्पोस्ट',
      cat: 'fertilizers',
      v: 2,
      hsn: '3101',
      gst: 5,
      unit: 'bag',
      variants: [{ sku: 'VERMI-25KG', name: '25 kg bag', mrp: 450, price: 380, stock: 120 }],
    },
  ];
  for (const p of productDefs) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        vendorId: vendors[p.v].id,
        categoryId: cats[p.cat],
        name: p.name,
        nameHi: p.nameHi,
        slug: p.slug,
        description: `${p.name} — seeded sample product`,
        hsnCode: p.hsn,
        gstRate: D(p.gst),
        unitOfMeasure: p.unit,
        status: 'ACTIVE',
        moderationStatus: 'APPROVED',
      },
    });
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: product.id,
          sku: v.sku,
          variantName: v.name,
          mrp: D(v.mrp),
          sellingPrice: D(v.price),
          stockQuantity: v.stock,
          reorderThreshold: 10,
        },
      });
    }
  }

  // ── Coupons ──────────────────────────────────────────────
  const now = new Date();
  const inOneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const couponDefs = [
    {
      code: 'WELCOME10',
      title: '10% off your first order',
      type: 'PERCENTAGE' as const,
      value: 10,
      minimumAmount: 500,
      maximumDiscount: 200,
      usageLimit: 1000,
    },
    {
      code: 'FLAT100',
      title: '₹100 off on orders above ₹1000',
      type: 'FIXED' as const,
      value: 100,
      minimumAmount: 1000,
      usageLimit: 500,
    },
    {
      code: 'FREESHIP',
      title: 'Free delivery',
      type: 'FREE_DELIVERY' as const,
      value: 0,
      minimumAmount: 300,
      usageLimit: null,
    },
  ];
  // A coupon that only discounts one seller (vendor 1) - exercises vendor-scoped coupons across sub-orders.
  await prisma.coupon.upsert({
    where: { code: 'GREENVALLEY50' },
    update: {},
    create: {
      code: 'GREENVALLEY50',
      title: '₹50 off Green Valley Agro Store products',
      type: 'FIXED',
      value: D(50),
      minimumAmount: D(200),
      applicableTo: 'VENDOR',
      vendorId: vendors[1].id,
      perUserLimit: 3,
      startsAt: now,
      expiresAt: inOneYear,
    },
  });
  for (const c of couponDefs) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        title: c.title,
        type: c.type,
        value: D(c.value),
        minimumAmount: D(c.minimumAmount),
        maximumDiscount: c.maximumDiscount ? D(c.maximumDiscount) : null,
        usageLimit: c.usageLimit,
        startsAt: now,
        expiresAt: inOneYear,
      },
    });
  }

  // ── Khata accounts (vendor × farmer) ─────────────────────
  const khataDefs = [
    { vendor: 0, farmer: 0, limit: 50000, interest: 12 },
    { vendor: 0, farmer: 1, limit: 30000, interest: 12 },
    { vendor: 1, farmer: 2, limit: 40000, interest: 10 },
    // Farmer 0 has khata with all three sellers: a mixed-vendor cart can be paid on credit per vendor.
    { vendor: 1, farmer: 0, limit: 20000, interest: 12 },
    { vendor: 2, farmer: 0, limit: 25000, interest: 12 },
  ];
  for (const k of khataDefs) {
    await prisma.khataAccount.upsert({
      where: { vendorId_farmerId: { vendorId: vendors[k.vendor].id, farmerId: farmers[k.farmer].id } },
      update: {},
      create: {
        vendorId: vendors[k.vendor].id,
        farmerId: farmers[k.farmer].id,
        creditLimitAmount: D(k.limit),
        interestRatePct: D(k.interest),
        creditPeriodDays: 30,
      },
    });
  }

  console.log(
    '[seed] done. Dev logins (phone / password): admin 9000000001, vendors 9000000011-13 (UP, MH, KA), farmers 9000000021-23 (UP, MH, KA)',
  );
  console.log(
    `[seed] password: ${process.env.SEED_PASSWORD || process.env.SEED_ADMIN_PASSWORD ? '(from SEED_* env)' : DEV_DEFAULT_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
