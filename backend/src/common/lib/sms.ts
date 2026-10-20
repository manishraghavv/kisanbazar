/**
 * SMS Provider Integration
 *
 * Uses Twilio to send transactional SMS messages.
 * Falls back gracefully when credentials aren't configured.
 */

import { describeSmsForLog } from '../utils/otpLog';

// ── Config ───────────────────────────────────────────────────────────────────

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: import('twilio').Twilio | null = null;

function getClient() {
  if (twilioClient) return twilioClient;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('[SMS] Twilio not configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    return null;
  }
  try {
    const twilio = require('twilio');
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, { lazyLoading: true });
    return twilioClient;
  } catch (err) {
    console.error('[SMS] Failed to initialize Twilio client:', (err as Error).message);
    return null;
  }
}

// ── Send SMS ─────────────────────────────────────────────────────────────────

export async function sendSms(to: string, message: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.log(`[SMS-DEV] Would send SMS ${describeSmsForLog(to, message)}`);
    return false;
  }

  if (!TWILIO_PHONE_NUMBER) {
    console.warn('[SMS] TWILIO_PHONE_NUMBER not set — cannot send SMS');
    return false;
  }

  try {
    const result = await client.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to,
      body: message,
    });
    console.log(`[SMS] Sent to ${to}: sid=${result.sid}, status=${result.status}`);
    return true;
  } catch (err) {
    console.error(`[SMS] Failed to send to ${to}:`, (err as Error).message);
    return false;
  }
}

export function isSmsConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}
