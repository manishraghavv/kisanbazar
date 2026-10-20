/**
 * OTPs and SMS bodies containing them must never reach production logs.
 * In non-production environments they are printed to make local testing possible.
 */
export function logOtpForDev(phoneNumber: string, otp: string, env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') {
    console.warn(`[OTP] SMS delivery is disabled (SMS_ENABLED != true); OTP for ${maskPhone(phoneNumber)} was generated but NOT delivered`);
    return;
  }
  console.log(`[DEV] OTP for ${phoneNumber}: ${otp}`);
}

/** Message previews may contain OTPs, so production logs only the recipient. */
export function describeSmsForLog(to: string, message: string, env: NodeJS.ProcessEnv = process.env): string {
  return env.NODE_ENV === 'production' ? `to ${maskPhone(to)}` : `to ${to}: ${message.slice(0, 100)}`;
}

export function maskPhone(phone: string): string {
  return phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : '****';
}
