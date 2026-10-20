/** Shared test configuration. All values are fake; the database is the disposable docker `postgres-test` service. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@localhost:5434/multivendor_test?schema=public';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdefghij-xyz',
  JWT_REFRESH_SECRET: 'test-refresh-secret-9876543210zyxwvutsrq-abc',
  RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret-123456',
  // Keep limiters out of the way; they have their own unit tests.
  RATE_LIMIT_MAX_STRICT: '100000',
  RATE_LIMIT_MAX_AUTH: '100000',
  RATE_LIMIT_MAX_GENERAL: '100000',
  // No external services in tests.
  REDIS_URL: '',
  SMS_ENABLED: 'false',
  EMAIL_ENABLED: 'false',
  PUSH_ENABLED: 'false',
};
