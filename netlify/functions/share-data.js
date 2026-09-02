// share-data.js — endpoint GET untuk viewer TSK publik.
//
// share.html memuat fetch('/api/share-data?job=KODE') (bukan POST action
// seperti fungsi lain). Netlify me-redirect /api/* -> /.netlify/functions/*,
// jadi file ini harus ada dengan nama share-data supaya redirect nyambung.
// Logika di handleShareData (netlify/functions/_lib/actions-share.js —
// Fase 1.1d: dipindah dari handlers.js, handlers tetap re-export untuk
// serve-static.mjs yang memakai loadHandlers().handleShareData).
'use strict';

const { handleShareData } = require('./_lib/actions-share');

exports.handler = async (event) => {
  const job = (event.queryStringParameters && event.queryStringParameters.job) || '';
  let out;
  try {
    out = await handleShareData(job);
  } catch (e) {
    out = { error: 'Error internal: ' + e.message };
  }
  return {
    statusCode: out.error ? 400 : 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(out),
  };
};
