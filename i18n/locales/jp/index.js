// i18n/locales/jp/index.js — agregat domain (Fase 4).
// Gabungan per-domain; urutan tidak masalah karena tiap domain unik.
import { loader } from './loader.js';
import { a11y } from './a11y.js';
import { header } from './header.js';
import { form } from './form.js';
import { publicKeys } from './public.js';
import { status } from './status.js';
import { table } from './table.js';
import { landing } from './landing.js';
import { siswa } from './siswa.js';
import { ui } from './ui.js';
import { candidate } from './candidate.js';
import { admin } from './admin.js';
import { button } from './button.js';
import { footer } from './footer.js';
import { alert } from './alert.js';

export const jp = {
  ...loader,
  ...a11y,
  ...form,
  ...header,
  ...publicKeys,
  ...status,
  ...table,
  ...landing,
  ...siswa,
  ...ui,
  ...candidate,
  ...admin,
  ...button,
  ...footer,
  ...alert,
};
