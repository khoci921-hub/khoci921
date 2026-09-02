// ping.js — lightweight health check endpoint.
//
// GET /.netlify/functions/ping → { status: "ok", version, uptime }
// Tidak memuat handler stack / DB — cepat dan murah untuk uptime monitoring.
'use strict';

const startedAt = Date.now();

exports.handler = async (event) => {
  const body = JSON.stringify({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
    },
    body,
  };
};
