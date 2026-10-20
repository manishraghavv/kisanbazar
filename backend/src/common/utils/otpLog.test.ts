import { describe, it, expect, vi, afterEach } from 'vitest';
import { logOtpForDev, describeSmsForLog, maskPhone } from './otpLog';

afterEach(() => vi.restoreAllMocks());

const env = (NODE_ENV: string) => ({ NODE_ENV }) as NodeJS.ProcessEnv;

describe('logOtpForDev', () => {
  it('prints the OTP outside production', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logOtpForDev('+919876543210', '123456', env('development'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('123456'));
  });

  it('never prints the OTP in production, on any console method', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logOtpForDev('+919876543210', '123456', env('production'));
    const output = [...log.mock.calls, ...warn.mock.calls, ...info.mock.calls].flat().join(' ');
    expect(output).not.toContain('123456');
    expect(output).not.toContain('+919876543210');
    expect(warn).toHaveBeenCalled();
  });
});

describe('describeSmsForLog', () => {
  it('omits the message body in production', () => {
    const out = describeSmsForLog('+919876543210', 'Your OTP is 123456', env('production'));
    expect(out).not.toContain('123456');
    expect(out).toContain('3210');
  });
  it('includes the body in development', () => {
    expect(describeSmsForLog('+91999', 'Your OTP is 123456', env('development'))).toContain('123456');
  });
});

describe('maskPhone', () => {
  it('keeps only the last 4 digits', () => expect(maskPhone('+919876543210')).toBe('*********3210'));
});
