import { handleAction } from './handlers';
// netlify-wrapper.js — factory handler Netlify standar.
//
// Setiap file di netlify/functions/<nama>.js hanyalah:
//   exports.handler = makeHandler();
// dan seluruh logika dipusatkan di _lib/handlers.js (dispatch per action).

// Ambil IP klien dari header standar proxy/Netlify untuk rate limit (M3).
// FIX #1 (audit 2026-09-02): X-Forwarded-For leftmost is attacker-controlled.
// Prefer Netlify's own x-nf-client-connection-ip (unspoofable). Fall back to
// the RIGHTMOST entry in X-Forwarded-For (written by our own edge), not [0].
function clientIp(event) {
  const h = (event && event.headers) || {};
  // Netlify injects this header — it is the true client IP and cannot be
  // spoofed by the caller (unlike X-Forwarded-For which is appended left).
  const nf = h['x-nf-client-connection-ip'];
  if (nf) return String(nf).trim();
  const fwd = h['x-forwarded-for'];
  if (fwd) {
    const parts = String(fwd).split(',').map(s => s.trim()).filter(Boolean);
    // Rightmost entry is written by our own edge proxy — the trustworthy one.
    return parts[parts.length - 1] || null;
  }
  return h['client-ip'] || h['x-real-ip'] || null;
}

function makeHandler() {
  return async (event) => {
    let body: Record<string, any> = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      /* body non-JSON -> action kosong */
    }
    // Keep-alive via GET (curl ?action=ping) — action boleh datang dari query
    // string kalau body kosong (mis. GitHub Actions keep-alive).
    if (!body.action) {
      const q = (event && event.queryStringParameters) || {};
      body.action = body.action || q.action || undefined;
      if (body.action) {
        body.payload = body.payload || q.payload || undefined;
      }
    }
    let out;
    try {
      out = await handleAction(body.action, body.payload, body.sessionToken, {
        ip: clientIp(event),
      });
    } catch (e) {
      out = { success: false, message: 'Error internal: ' + e.message };
    }
    const baseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    };
    // Respons RAW dari handler (action 'ping': { statusCode: 200, body: 'pong' })
    // diteruskan apa adanya — tanpa JSON.stringify, tanpa bungkus tambahan.
    if (
      out &&
      typeof out === 'object' &&
      typeof out.statusCode === 'number' &&
      out.body !== undefined
    ) {
      return {
        statusCode: out.statusCode,
        headers: baseHeaders,
        body: String(out.body),
      };
    }
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify(out),
    };
  };
}

export { makeHandler };
