// sentry-dummy.js — Stub untuk importmap @sentry/browser di halaman standalone.
// Sentry di-load via CDN lazy (lihat js/core/sentry.ts) — file ini hanya
// mencegah browser error saat resolve bare specifier '@sentry/browser'.
export default {};
export function init() {}
export function captureException() {}
export function captureMessage() {}
export function withScope() {}
export function setTag() {}
export function setUser() {}
export function setContext() {}
export function addBreadcrumb() {}
