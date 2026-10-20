import { describe, expect, it } from 'vitest';
import { api, bearer, createCatalogItem, registerAndLogin } from '../helpers';

describe('public endpoints work without a token', () => {
  it.each(['/api/coupons', '/api/industries', '/api/enterprise-tiers', '/api/products', '/api/categories', '/api/categories/tree'])(
    'GET %s',
    async (path) => {
      const res = await api().get(path);
      expect(res.status).toBe(200);
    },
  );

  it('GET /api/products/:id and its reviews are public', async () => {
    const { product } = await createCatalogItem();
    expect((await api().get(`/api/products/${product.id}`)).status).toBe(200);
    expect((await api().get(`/api/products/${product.id}/reviews`)).status).toBe(200);
  });
});

describe('auth scoping does not leak across routers', () => {
  it('a non-admin reaches non-admin routes mounted after the admin router', async () => {
    const farmer = await registerAndLogin('FARMER');
    // Previously the admin router gated everything mounted after it with authorize(ADMIN).
    const res = await api().get('/api/orders/00000000-0000-0000-0000-000000000000/invoice-data').set(bearer(farmer));
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('/api/admin/* still requires ADMIN', async () => {
    const farmer = await registerAndLogin('FARMER');
    expect((await api().get('/api/admin/crons/status')).status).toBe(401);
    expect((await api().get('/api/admin/crons/status').set(bearer(farmer))).status).toBe(403);
  });
});
