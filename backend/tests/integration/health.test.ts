import { describe, expect, it } from 'vitest';
import { api } from '../helpers';

describe('health', () => {
  it('GET /health responds 200 OK', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('unknown routes return the JSON 404 envelope', async () => {
    const res = await api().get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
