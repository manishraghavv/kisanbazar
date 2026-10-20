import { describe, expect, it } from 'vitest';
import { api, bearer, createCatalogItem, registerAndLogin } from '../helpers';

describe('cart and wishlist paths', () => {
  it('require authentication', async () => {
    expect((await api().get('/api/cart')).status).toBe(401);
    expect((await api().get('/api/wishlist')).status).toBe(401);
    expect((await api().get('/api/orders')).status).toBe(401);
  });

  it('the old /orders/cart and /orders/wishlist paths are gone', async () => {
    const farmer = await registerAndLogin('FARMER');
    const cart = await api().get('/api/orders/cart').set(bearer(farmer));
    const wishlist = await api().get('/api/orders/wishlist').set(bearer(farmer));
    expect(cart.status).not.toBe(200);
    expect(wishlist.status).not.toBe(200);
  });

  it('cart: add, read, update, remove', async () => {
    const farmer = await registerAndLogin('FARMER');
    const { variant } = await createCatalogItem({ stock: 20, price: 100 });

    const empty = await api().get('/api/cart').set(bearer(farmer));
    expect(empty.status).toBe(200);

    const add = await api().post('/api/cart/items').set(bearer(farmer)).send({ variantId: variant.id, quantity: 2 });
    expect(add.status).toBeLessThan(300);

    const cart = await api().get('/api/cart').set(bearer(farmer));
    expect(cart.status).toBe(200);
    const items = cart.body.data.items ?? cart.body.data.cart?.items;
    expect(items).toHaveLength(1);
    const itemId = items[0].id;

    const upd = await api().put(`/api/cart/items/${itemId}`).set(bearer(farmer)).send({ quantity: 3 });
    expect(upd.status).toBe(200);

    const del = await api().delete(`/api/cart/items/${itemId}`).set(bearer(farmer));
    expect(del.status).toBeLessThan(300);
  });

  it('wishlist: add, read, remove', async () => {
    const farmer = await registerAndLogin('FARMER');
    const { product } = await createCatalogItem();

    const add = await api().post('/api/wishlist/items').set(bearer(farmer)).send({ productId: product.id });
    expect(add.status).toBeLessThan(300);

    const list = await api().get('/api/wishlist').set(bearer(farmer));
    expect(list.status).toBe(200);
    const items = list.body.data.items ?? list.body.data.wishlist?.items;
    expect(items).toHaveLength(1);

    const del = await api().delete(`/api/wishlist/items/${items[0].id}`).set(bearer(farmer));
    expect(del.status).toBeLessThan(300);
  });
});
