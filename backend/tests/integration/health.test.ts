import { describe, expect, it } from 'vitest';
import { api } from '../helpers';

describe('health', () => {
  it('GET /health checks the database and reports redis as disabled when unconfigured', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.checks).toEqual({ database: 'up', redis: 'disabled' });
  });

  it('GET /ready is 200 when dependencies are up', async () => {
    const res = await api().get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe('up');
  });

  it('unknown routes return the JSON 404 envelope', async () => {
    const res = await api().get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
