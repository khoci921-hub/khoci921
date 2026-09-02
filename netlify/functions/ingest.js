'use strict';
const { handleProcessUploadDoc } = require('./_lib/actions-ingest');
const { verifyToken } = require('./_lib/session');

// ingest.js — Standalone wrapper untuk Smart Ingestion.
// HANYA membundel actions-ingest.ts + deps-nya (pdf-parse, xlsx, mammoth).
// Function lain TIDAK perlu membundel library berat ini.
// Dipanggil dari api-client.js: processUploadDoc → 'ingest'

function clientIp(event) {
  const h = (event && event.headers) || {};
  const fwd = h['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return h['client-ip'] || h['x-real-ip'] || null;
}

exports.handler = async (event) => {
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    /* body non-JSON */
  }

  const { action, payload, sessionToken } = body;

  if (action !== 'processUploadDoc') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        message: 'Action not supported by ingest function: ' + action,
      }),
    };
  }

  let out;
  try {
    out = await handleProcessUploadDoc(payload || [], sessionToken);
  } catch (e) {
    out = { success: false, message: 'Error internal: ' + e.message };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(out),
  };
};
