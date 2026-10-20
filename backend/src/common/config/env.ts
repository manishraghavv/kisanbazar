import Joi from 'joi';

/**
 * Boot-time environment validation. The server refuses to start when a
 * security-critical variable is missing or weak; there are no insecure defaults.
 */

const WEAK_SECRETS = new Set([
  'access_secret',
  'refresh_secret',
  'secret',
  'changeme',
  'change_me',
  'password',
  'jwt_secret',
  'your-secret',
  'your_secret',
]);

const PLACEHOLDER_PATTERN = /change[-_ ]?(me|this)|your[-_ ]|example|placeholder|replace[-_ ]?me/i;

const MIN_SECRET_LENGTH = 32;
const MAX_ACCESS_TTL_SECONDS = 15 * 60;

const UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses "900", "900s", "15m", "1h", "7d" into seconds; returns NaN when invalid. */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) return NaN;
  return Number(match[1]) * UNITS[match[2] ?? 's'];
}

const strongSecret = Joi.string()
  .min(MIN_SECRET_LENGTH)
  .custom((value: string, helpers) => {
    if (WEAK_SECRETS.has(value.toLowerCase()) || PLACEHOLDER_PATTERN.test(value)) return helpers.error('any.invalid');
    if (new Set(value).size < 8) return helpers.error('any.invalid'); // e.g. "aaaaaaaa…"
    return value;
  }, 'weak secret check')
  .messages({
    'string.min': `{{#label}} must be at least ${MIN_SECRET_LENGTH} characters (generate with: openssl rand -hex 48)`,
    'any.invalid': '{{#label}} is a known-weak or low-entropy value',
  });

const isProduction = Joi.ref('NODE_ENV');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: strongSecret.required(),
  JWT_REFRESH_SECRET: strongSecret.required().invalid(Joi.ref('JWT_ACCESS_SECRET')).messages({
    'any.invalid': 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .default('15m')
    .custom((value: string, helpers) => {
      const seconds = durationToSeconds(value);
      if (Number.isNaN(seconds) || seconds <= 0 || seconds > MAX_ACCESS_TTL_SECONDS)
        return helpers.error('any.invalid');
      return value;
    }, 'access ttl')
    .messages({ 'any.invalid': 'JWT_ACCESS_EXPIRES_IN must be a duration like "15m" and at most 15 minutes' }),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Required (and wildcard-free) in production so CORS fails closed.
  CORS_ORIGIN: Joi.when(isProduction, {
    is: 'production',
    then: Joi.string()
      .required()
      .custom((value: string, helpers) => {
        const origins = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (origins.length === 0 || origins.includes('*')) return helpers.error('any.invalid');
        return value;
      }, 'cors allow-list')
      .messages({ 'any.invalid': 'CORS_ORIGIN must be an explicit comma-separated allow-list (no "*") in production' }),
    otherwise: Joi.string().allow('').optional(),
  }),

  // Real gateway credentials are mandatory in production; elsewhere the fake gateway is used when unset.
  RAZORPAY_KEY_ID: Joi.when(isProduction, {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  RAZORPAY_KEY_SECRET: Joi.when(isProduction, {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  RAZORPAY_WEBHOOK_SECRET: Joi.when(isProduction, {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
}).unknown(true);

export class EnvValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

export function validateEnv(source: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const { error, value } = schema.validate(source, { abortEarly: false });
  if (error) throw new EnvValidationError(error.details.map((d) => d.message));
  return value;
}

/** Validates and writes defaults (PORT, NODE_ENV, TTLs) back into process.env. Exits the process on failure. */
export function validateEnvOrExit(): void {
  try {
    const value = validateEnv(process.env) as Record<string, string | number>;
    for (const key of ['NODE_ENV', 'PORT', 'JWT_ACCESS_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN']) {
      process.env[key] = String(value[key]);
    }
  } catch (err) {
    console.error(`[ENV] ${(err as Error).message}`);
    process.exit(1);
  }
}
