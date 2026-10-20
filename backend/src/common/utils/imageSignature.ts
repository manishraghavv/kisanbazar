/**
 * Identify an image by its leading bytes ("magic numbers"). The client-supplied
 * mimetype and filename are never trusted: they are trivially spoofed.
 */

export interface DetectedImage {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: '.jpg' | '.png' | '.webp';
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

export function detectImageType(buf: Buffer): DetectedImage | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: '.jpg' };
  if (startsWith(buf, PNG_SIGNATURE)) return { mime: 'image/png', ext: '.png' };
  // WebP: "RIFF" <4-byte size> "WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}
