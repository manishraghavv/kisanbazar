import { describe, expect, it } from 'vitest';
import { buildHealthReport } from './health';

const up = async () => 'up' as const;
const down = async () => 'down' as const;
const disabled = async () => 'disabled' as const;

describe('buildHealthReport', () => {
  it('is 200 when the database is up and redis is up', async () => {
    const { httpStatus, report } = await buildHealthReport({ checkDatabase: up, checkRedis: up });
    expect(httpStatus).toBe(200);
    expect(report.status).toBe('OK');
  });

  it('is 200 when redis is not configured', async () => {
    const { httpStatus, report } = await buildHealthReport({ checkDatabase: up, checkRedis: disabled });
    expect(httpStatus).toBe(200);
    expect(report.checks.redis).toBe('disabled');
  });

  it('is 503 when the database is down', async () => {
    const { httpStatus, report } = await buildHealthReport({ checkDatabase: down, checkRedis: up });
    expect(httpStatus).toBe(503);
    expect(report.checks.database).toBe('down');
  });

  it('is 503 when a configured redis is down', async () => {
    const { httpStatus } = await buildHealthReport({ checkDatabase: up, checkRedis: down });
    expect(httpStatus).toBe(503);
  });
});
