import { describe, expect, it } from 'vitest';
import { api, bearer, prisma, registerAndLogin, uniquePhone } from '../helpers';

describe('auth', () => {
  it('registers, logs in and reads /users/me', async () => {
    const user = await registerAndLogin('FARMER');
    const me = await api().get('/api/users/me').set(bearer(user));
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).toContain(user.phoneNumber);
  });

  it('rejects wrong passwords', async () => {
    const user = await registerAndLogin('FARMER');
    const res = await api().post('/api/auth/login').send({ phoneNumber: user.phoneNumber, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects duplicate phone numbers', async () => {
    const user = await registerAndLogin('FARMER');
    const res = await api()
      .post('/api/auth/register')
      .send({ fullName: 'Dup', phoneNumber: user.phoneNumber, password: 'Test@12345', role: 'FARMER' });
    expect(res.status).toBe(409);
  });

  it('does not allow self-registration as ADMIN or DELIVERY', async () => {
    for (const role of ['ADMIN', 'DELIVERY']) {
      const res = await api()
        .post('/api/auth/register')
        .send({ fullName: 'Sneaky', phoneNumber: uniquePhone(), password: 'Test@12345', role });
      expect(res.status).toBe(422);
    }
  });

  it('protected routes need a valid token', async () => {
    expect((await api().get('/api/users/me')).status).toBe(401);
    expect((await api().get('/api/users/me').set('Authorization', 'Bearer not-a-token')).status).toBe(401);
  });

  it('a blocked user loses access immediately', async () => {
    const user = await registerAndLogin('FARMER');
    await prisma.user.update({ where: { id: user.id }, data: { status: 'BLOCKED' } });
    const res = await api().get('/api/users/me').set(bearer(user));
    expect([401, 403]).toContain(res.status);
  });
});
