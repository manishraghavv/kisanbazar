import { describe, expect, it } from 'vitest';
import { api, bearer, createCatalogItem, registerAndLogin } from '../helpers';

/** The customer journey over real HTTP, exactly as the frontend drives it. */
describe('farmer journey over HTTP: address -> cart -> quote -> order -> detail', () => {
  it('works end to end for a cart that spans three sellers in three states', async () => {
    const a = await createCatalogItem({ stock: 20, price: 100, gstRate: 5, vendorState: '09' });
    const b = await createCatalogItem({ stock: 20, price: 400, gstRate: 12, vendorState: '27' });
    const c = await createCatalogItem({ stock: 20, price: 50, gstRate: 18, vendorState: '29' });
    const farmer = await registerAndLogin('FARMER');
    const auth = bearer(farmer);

    // addresses: listing used to 500 because the table had no createdAt
    expect((await api().get('/api/addresses').set(auth)).body.data).toEqual([]);
    const created = await api()
      .post('/api/addresses')
      .set(auth)
      .send({ addressLine1: '12 Mandi Road', city: 'Meerut', stateCode: '09', pincode: '250001', isDefault: true });
    expect(created.status).toBe(201);
    const listed = await api().get('/api/addresses').set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].createdAt).toBeTruthy();
    const addressId = created.body.data.id;

    for (const [item, quantity] of [
      [a, 2],
      [b, 1],
      [c, 3],
    ] as const) {
      const res = await api().post('/api/cart/items').set(auth).send({ variantId: item.variant.id, quantity });
      expect(res.status).toBe(201);
    }

    const quote = await api().post('/api/orders/quote').set(auth).send({ addressId });
    expect(quote.status).toBe(200);
    expect(quote.body.data.subOrders).toHaveLength(3);
    const regimes = quote.body.data.subOrders.map((s: { interState: boolean }) => s.interState).sort();
    expect(regimes).toEqual([false, true, true]);

    const placed = await api().post('/api/orders').set(auth).send({ addressId, paymentMethod: 'COD' });
    expect(placed.status).toBe(201);
    expect(placed.body.data.subOrders).toHaveLength(3);
    expect(placed.body.data.totalAmount).toBe(quote.body.data.totals.totalAmount);

    const detail = await api().get(`/api/orders/${placed.body.data.id}`).set(auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.subOrders).toHaveLength(3);
    expect(detail.body.data.items).toHaveLength(3);
    expect(detail.body.data.payments.some((p: { paymentMethod: string }) => p.paymentMethod === 'COD')).toBe(true);

    const list = await api().get('/api/orders').set(auth);
    expect(list.status).toBe(200);
    expect(list.body.data[0].subOrders).toHaveLength(3);

    // each seller sees exactly their own part and can act on it
    for (const v of [a, b, c]) {
      const mine = await api().get('/api/sub-orders').set(bearer(v.vendorUser));
      expect(mine.status).toBe(200);
      expect(mine.body.data).toHaveLength(1);
      expect(mine.body.data[0].vendorId).toBe(v.vendor.id);
    }
  });
});
