import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './testEnv';

/** Applies all migrations to the test database once per run (idempotent: `migrate deploy` skips applied ones). */
export default function setup(): void {
  const url = new URL(TEST_DATABASE_URL.replace(/^postgres(ql)?:/, 'http:'));
  if (!['localhost', '127.0.0.1', 'postgres-test'].includes(url.hostname)) {
    throw new Error(`Refusing to run integration tests against non-local database host "${url.hostname}"`);
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
