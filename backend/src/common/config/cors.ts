/**
 * CORS allow-list shared by Express and Socket.io.
 * There is no wildcard fallback: production requires an explicit CORS_ORIGIN
 * (enforced at boot by env validation); development defaults to local frontends.
 */

const DEV_DEFAULT_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter((s) => s && s !== '*');

  if (configured.length > 0) return configured;
  return env.NODE_ENV === 'production' ? [] : DEV_DEFAULT_ORIGINS; // empty list in production = fail closed
}

type OriginCallback = (err: Error | null, allow?: boolean) => void;

export function corsOriginCheck(allowed: string[] = getAllowedOrigins()) {
  return (origin: string | undefined, callback: OriginCallback): void => {
    // No Origin header: same-origin or non-browser clients (curl, gateway webhooks, health checks).
    if (!origin) return callback(null, true);
    callback(null, allowed.includes(origin.replace(/\/$/, '')));
  };
}
