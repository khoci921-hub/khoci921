// ==========================================
// TESTS: ping.js — lightweight health check.
// ==========================================
import { describe, it, expect } from 'vitest';
import { handler } from '../netlify/functions/ping.js';

describe('ping — health check endpoint', () => {
  it('returns status ok with required fields', async () => {
    const result = await handler({});
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });

  it('returns no-cache headers', async () => {
    const result = await handler({});
    expect(result.headers['Cache-Control']).toBe('no-cache, no-store');
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('uptime increases between calls', async () => {
    const r1 = await handler({});
    const b1 = JSON.parse(r1.body);
    // Small delay
    await new Promise((r) => setTimeout(r, 10));
    const r2 = await handler({});
    const b2 = JSON.parse(r2.body);
    expect(b2.uptime).toBeGreaterThanOrEqual(b1.uptime);
  });
});
