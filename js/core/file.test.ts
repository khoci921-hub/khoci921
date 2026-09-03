// ==========================================
// TESTS: js/core/file — base64ToBlob kanonikal halaman standalone.
// ==========================================
import { describe, it, expect } from 'vitest';
import { base64ToBlob } from './file';

describe('base64ToBlob', () => {
  it('base64 → Blob dengan mime yang diminta', async () => {
    const b64 = btoa('hello world');
    const blob = base64ToBlob(b64, 'text/plain');
    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('hello world');
  });

  it('ukuran > 512 byte (loop chunk) tetap utuh', async () => {
    const raw = 'x'.repeat(5000);
    const blob = base64ToBlob(btoa(raw), 'application/octet-stream');
    expect(await blob.text()).toBe(raw);
  });
});
