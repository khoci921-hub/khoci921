import { normalizeWa, pick, supabaseJson, toText } from './db/client';
import { findCandidatesByJobFiltered, findCandidates } from './db/candidates';
import { fetchMasterByWa } from './db/master';
import { requireRole } from './actions-auth';
// actions-download.ts — download semua berkas/dokumen kandidat per job sebagai ZIP.
// Dipanggil admin dari tab Histori Job Internal.

// Kolom dokumen di master_database_candidate yang akan di-download
const DOC_COLUMNS: [string, string[]][] = [
  ['CV', ['file_cv']],
  ['JFT', ['jft_url', 'jft']],
  ['SSW', ['ssw_url', 'ssw']],
  ['PasFoto', ['pas_photo']],
  ['KTP', ['ktp_url']],
  ['KK', ['kk_url']],
  ['IjazahSD', ['ijazah_sd_url']],
  ['IjazahSMP', ['ijazah_smp_url']],
  ['IjazahSMA', ['ijazah_sma_url']],
  ['Universitas', ['univ_url']],
  ['Sertifikat', ['cert_url']],
  ['SIM', ['driver_license_url', 'sim_url']],
];

// Download file dari URL ke Buffer
async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// Dapatkan ekstensi file dari URL
function extFromUrl(url: string): string {
  const m = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  return m ? m[1].toLowerCase() : 'bin';
}

// Dapatkan nama file yang aman dari URL
function filenameFromUrl(url: string, label: string): string {
  const ext = extFromUrl(url);
  return label.replace(/[^a-zA-Z0-9_-]/g, '_') + '.' + ext;
}

// Sanitasi nama folder (untuk ZIP path)
function safeFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, '_').substring(0, 60) || 'KANDIDAT';
}

// ---------------------------------------------------------------------------
// handleDownloadJobDocs — download semua dokumen kandidat dalam 1 job sebagai ZIP
// payload: [code_job]
// Response: { success, zipBase64, fileName, totalFiles, totalSize } atau error
// ---------------------------------------------------------------------------
export async function handleDownloadJobDocs(payload: unknown[], sessionToken?: string) {
  const guard = requireRole(sessionToken, 'admin');
  if (guard.error) return guard.error;

  const code = String((payload && payload[0]) || '').trim();
  if (!code) return { success: false, error: 'Kode job wajib diisi.' };

  try {
    // 1. Cari semua kandidat untuk job ini
    let candidates = await findCandidatesByJobFiltered(code);
    if (!candidates || !candidates.length) {
      const all = await findCandidates();
      candidates = (all.rows || []).filter(
        (c) => String(pick(c, ['id_loker_pilihan', 'id_loker']) || '') === code,
      );
    }
    if (!candidates.length) {
      return {
        success: false,
        error:
          'Tidak ada kandidat untuk job ' +
          code +
          '. Pastikan kandidat sudah terdaftar di job ini.',
      };
    }
    console.log('[download] Found', candidates.length, 'candidates for job', code);

    // 2. Kumpulkan semua WA
    const waList = candidates
      .map((c) => normalizeWa(String(pick(c, ['no_wa', 'wa', 'whatsapp']) || '')))
      .filter(Boolean);
    console.log('[download] WA list:', waList.length, 'entries');

    // 3. Tarik master data untuk semua kandidat (batch)
    // Guard: jangan kirim query kosong ke Supabase
    const masterRows = waList.length ? await fetchMasterByWa(waList) : [];
    const masterByWa = new Map<string, Record<string, unknown>>();
    if (Array.isArray(masterRows)) {
      for (const row of masterRows) {
        const wa = normalizeWa(String(row.no_wa || ''));
        if (wa) masterByWa.set(wa, row);
      }
    }

    // 4. Kumpulkan semua URL dokumen
    const downloads: { url: string; folder: string; label: string }[] = [];
    for (const cand of candidates) {
      if (!cand || typeof cand !== 'object') continue;
      const wa = normalizeWa(String(pick(cand, ['no_wa', 'wa', 'whatsapp']) || ''));
      const nama = safeFolderName(
        String(pick(cand, ['nama_lengkap', 'nama']) || 'KANDIDAT').toUpperCase(),
      );
      const master = wa ? masterByWa.get(wa) : null;

      for (const [label, cols] of DOC_COLUMNS) {
        let url = '';
        if (master) {
          for (const col of cols) {
            const v = toText(master[col] || '');
            if (v && v !== '-' && v.startsWith('http')) {
              url = v;
              break;
            }
          }
        }
        if (cand && !url) {
          for (const col of cols) {
            const v = toText(cand[col] || '');
            if (v && v !== '-' && v.startsWith('http')) {
              url = v;
              break;
            }
          }
        }
        if (url) {
          downloads.push({ url, folder: nama, label });
        }
      }
    }

    if (!downloads.length) {
      return {
        success: false,
        error:
          'Tidak ada dokumen yang bisa di-download untuk ' +
          candidates.length +
          ' kandidat. Pastikan data master sudah dilengkapi.',
      };
    }
    console.log(
      '[download] Found',
      downloads.length,
      'files to download from',
      candidates.length,
      'candidates',
    );

    // 5. Download semua file dan masukkan ke ZIP
    const archiverMod = await import('archiver');
    // ESM export: { ZipArchive } class. CJS fallback: function('zip').
    const ZipClass = (archiverMod as any).ZipArchive;
    const ArchiveClass = ZipClass || (archiverMod as any).Archiver || (archiverMod as any).default;
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      const archive = ZipClass
        ? new ZipClass('zip', { zlib: { level: 6 } })
        : typeof ArchiveClass === 'function'
          ? new ArchiveClass('zip', { zlib: { level: 6 } })
          : (archiverMod as any)('zip', { zlib: { level: 6 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => {
        const zipBuf = Buffer.concat(chunks);
        resolve({
          success: true,
          zipBase64: zipBuf.toString('base64'),
          fileName: 'Dokumen_' + code + '.zip',
          totalFiles: downloads.length,
          totalSize: zipBuf.length,
          candidateCount: candidates.length,
        });
      });
      archive.on('error', (err: Error) => {
        resolve({ success: false, error: 'Gagal membuat ZIP: ' + err.message });
      });

      // Process downloads sequentially to avoid memory spike
      let processed = 0;
      const total = downloads.length;

      async function processNext() {
        try {
          if (processed >= total) {
            archive.finalize();
            return;
          }
          const d = downloads[processed];
          processed++;
          const buf = await fetchBuffer(d.url);
          if (buf) {
            const fileName = filenameFromUrl(d.url, d.label);
            archive.append(buf, { name: d.folder + '/' + fileName });
          } else {
            console.warn('[download] Skip file (fetch failed):', d.url.substring(0, 80));
          }
          await processNext();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[download] processNext error:', msg);
          archive.abort();
        }
      }

      processNext().catch((err: unknown) => {
        console.error('[download] processNext uncaught:', err);
        archive.abort();
      });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[download] downloadJobDocs error:', msg);
    return { success: false, error: 'Gagal download dokumen: ' + msg };
  }
}
