/**
 * Email Provider Integration
 *
 * Uses Resend to send transactional emails.
 * Falls back gracefully when the API key isn't configured.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@kisaanbazaar.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Kisaan Bazaar';

let resendClient: import('resend').Resend | null = null;

function getClient() {
  if (resendClient) return resendClient;
  if (!RESEND_API_KEY) {
    console.warn('[EMAIL] Resend not configured — set RESEND_API_KEY');
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy-load: only needed when configured
    const { Resend } = require('resend');
    resendClient = new Resend(RESEND_API_KEY);
    return resendClient;
  } catch (err) {
    console.error('[EMAIL] Failed to initialize Resend client:', (err as Error).message);
    return null;
  }
}

// ── Send Email ───────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.log(`[EMAIL-DEV] Would send email to ${to}: ${subject}`);
    return false;
  }

  try {
    const { data, error } = await client.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html: bodyHtml,
    });
    if (error) {
      console.error(`[EMAIL] Resend error for ${to}:`, error.message);
      return false;
    }
    console.log(`[EMAIL] Sent to ${to}: id=${data?.id ?? 'unknown'}, subject="${subject}"`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, (err as Error).message);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}
