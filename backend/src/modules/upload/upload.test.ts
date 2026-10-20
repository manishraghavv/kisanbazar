import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../common/middleware/authMiddleware', () => ({ authenticate: vi.fn(), authorize: vi.fn(() => vi.fn()) }));

import { detectImageType } from '../../common/utils/imageSignature';
import { saveImage } from './upload.routes';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by signature', () => {
    expect(detectImageType(JPEG)).toEqual({ mime: 'image/jpeg', ext: '.jpg' });
    expect(detectImageType(PNG)).toEqual({ mime: 'image/png', ext: '.png' });
    expect(detectImageType(WEBP)).toEqual({ mime: 'image/webp', ext: '.webp' });
  });

  it('rejects non-images regardless of what the client claimed', () => {
    expect(detectImageType(Buffer.from('<?php system($_GET["c"]); ?>'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('MZ\x90\x00'))).toBeNull(); // Windows executable
    expect(detectImageType(Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt '))).toBeNull(); // RIFF but not WebP
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull(); // truncated
  });
});

describe('saveImage', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('stores a valid image under a random name with an extension from the detected type', async () => {
    const a = await saveImage(PNG, dir);
    const b = await saveImage(PNG, dir);
    expect(a).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(b).not.toBe(a);
    expect(fs.readFileSync(path.join(dir, a!)).equals(PNG)).toBe(true);
  });

  it('writes nothing for a spoofed file (script renamed to .jpg)', async () => {
    expect(await saveImage(Buffer.from('<script>alert(1)</script>'), dir)).toBeNull();
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });
});
