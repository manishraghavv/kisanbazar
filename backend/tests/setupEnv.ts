import { TEST_ENV } from './testEnv';

// Runs before each test file's imports, so modules that read process.env at load time see test values.
for (const [key, value] of Object.entries(TEST_ENV)) process.env[key] = value;
