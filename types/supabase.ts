// types/supabase.ts — Manual type definitions for Supabase tables
// These are the 5 primary tables used across the ASJ Portal backend.
// Kept minimal: only columns actually queried in the codebase.

// ---------- Lowongan / Jobs ----------
export interface JobDatabase {
  id: number;
  code_job: string;
  nama_loker: string;
  perusahaan: string;
  lokasi_kerja: string;
  gaji: string;
  deskripsi: string;
  kuota: number;
  tahapan: string;
  status: string;
  foto_url: string;
  pamflet_url: string;
  template_cv_url: string;
  template_jft_url: string;
  share_token: string;
  share_drive_link: string;
  created_at: string;
  updated_at: string;
}

// ---------- Kandidat / Candidates ----------
export interface DatabaseCandidate {
  id: number;
  no_wa: string;
  nama_lengkap: string;
  nama_panggilan: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  agama: string;
  alamat: string;
  no_ktp: string;
  no_kk: string;
  nama_ayah: string;
  nama_ibu: string;
  foto_url: string;
  photo_url: string;
  cv_url: string;
  jft_url: string;
  ssw_url: string;
  ktp_url: string;
  kk_url: string;
  ijazah_url: string;
  passport_url: string;
  status: string;
  tahapan: string;
  code_job: string;
  catatan: string;
  ai_data_json: string;
  folder_id: string;
  created_at: string;
  updated_at: string;
}

// ---------- Mail Inbox / Application Forms ----------
export interface DatabaseAsjForm {
  id: number;
  no_wa: string;
  code_job: string;
  nama_lengkap: string;
  status: string;
  tahapan: string;
  form_data_json: string;
  reviewed: boolean;
  created_at: string;
  updated_at: string;
}

// ---------- Pemberkasan Checklist ----------
export interface PemberkasanChecklist {
  id: number;
  wa: string;
  tahap: string;
  nama_file: string;
  url_file: string;
  status: string;
  catatan: string;
  created_at: string;
  updated_at: string;
}

// ---------- Master Database / CV ----------
export interface MasterDatabaseCandidate {
  id: number;
  no_wa: string;
  nama_lengkap: string;
  data_json: string;
  created_at: string;
  updated_at: string;
}

// ---------- WA Templates ----------
export interface WaTemplate {
  id: number;
  nama: string;
  isi: string;
  created_at: string;
  updated_at: string;
}

// ---------- Environment Config ----------
export interface SysConfig {
  id: number;
  config_type: string;
  config_key: string;
  config_value: string;
  created_at: string;
  updated_at: string;
}

// ---------- Generic query result ----------
export interface QueryResult<T = Record<string, unknown>> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count?: number;
  status?: number;
  statusText?: string;
}

// ---------- Supabase REST response wrappers ----------
export interface SupabaseResponse<T = Record<string, unknown>> {
  data: T[] | null;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
  count?: number;
}
