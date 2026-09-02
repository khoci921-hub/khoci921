import { registerSeamAliases } from '../core/bridge.ts';
// js/admin_ops/{schedule,candidates,sysconfig,loading,migration,drive}.js.
// ==========================================
// MIGRASI DATABASE — jalankan migrasi dari tab Pengaturan, render hasil,
// salin SQL pending
// ==========================================

// === MIGRASI DATABASE (tombol di tab Pengaturan) ===
export async function jalankanMigrasi() {
  var btn = document.getElementById('btn-jalankan-migrasi');
  var statusEl = document.getElementById('migrasi-status');
  var resultsEl = document.getElementById('migrasi-results');
  var pendingEl = document.getElementById('migrasi-pending');
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> ' + window.tr('ui.running') + '';
  if (statusEl) statusEl.textContent = window.tr('ui.migration_wait');
  if (resultsEl) resultsEl.classList.add('hidden');
  if (pendingEl) pendingEl.classList.add('hidden');

  try {
    const res = await window.callAPI('runMigration', {});
    if (!res || !res.success) {
      if (statusEl) statusEl.textContent = '';
      window.showToast(
        window.tr('ui.toast_migrate_failed') +
          (res && res.error ? res.error : 'respon tidak valid'),
        'error',
      );
      if (res && res.results && res.results.length) renderMigrasiResults(res.results);
      return;
    }
    if (statusEl)
      statusEl.textContent = window.tr('ui.done') + new Date().toLocaleTimeString('id-ID');
    renderMigrasiResults(res.results || []);
    if (res.pendingSql && res.pendingSql.length) {
      var pre = document.getElementById('migrasi-pending-sql');
      if (pre) pre.textContent = res.pendingSql.join('\n\n');
      if (pendingEl) pendingEl.classList.remove('hidden');
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = '';
    window.showToast(window.tr('ui.toast_migrate_failed') + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play mr-1"></i> ' + window.tr('ui.run_migration') + '';
  }
}

export function renderMigrasiResults(list) {
  var box = document.getElementById('migrasi-results');
  if (!box) return;
  var icons = {
    ok: '<i class="fas fa-check-circle text-emerald-400"></i>',
    skip: '<i class="fas fa-check-circle text-slate-500"></i>',
    warn: '<i class="fas fa-exclamation-triangle text-amber-400"></i>',
    fail: '<i class="fas fa-times-circle text-rose-400"></i>',
  };
  box.innerHTML = list
    .map(function (r) {
      var color =
        r.status === 'fail'
          ? 'text-rose-300'
          : r.status === 'warn'
            ? 'text-amber-300'
            : 'text-slate-300';
      return (
        '<div class="flex items-start gap-2 text-[11px] ' +
        color +
        '">' +
        '<span class="mt-0.5">' +
        (icons[r.status] || icons.skip) +
        '</span>' +
        '<span><b>' +
        window.esc(r.step) +
        ':</b> ' +
        window.esc(r.detail) +
        '</span></div>'
      );
    })
    .join('');
  box.classList.remove('hidden');
}

export async function salinSqlMigrasi() {
  var pre = document.getElementById('migrasi-pending-sql');
  if (!pre || !pre.textContent) return;
  try {
    await navigator.clipboard.writeText(pre.textContent);
    window.showToast(window.tr('ui.toast_sql_copied'), 'success');
  } catch (err) {
    window.showToast(window.tr('ui.toast_copy_sql_failed'), 'error');
  }
}

// BRIDGE ESM → classic (bundel): alias window.* utk pemakai lintas file /
// HTML inline onclick (admin/index jalankanMigrasi / salinSqlMigrasi).
registerSeamAliases({
  jalankanMigrasi,
  salinSqlMigrasi,
});
