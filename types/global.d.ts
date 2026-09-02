// types/global.d.ts — Global declarations for ASJ Portal
// Window aliases (registered via bridge.js registerSeamAliases)
// Module shims for vendor scripts loaded via <script> tags

// ---------- Window interface augmentation ----------
interface Window {
  // Portal namespace (bridge.js)
  PortalBridge: Record<string, unknown>;

  // Admin session
  IS_ADMIN_PORTAL: boolean;

  // Theme
  currentTheme: string;

  // All seam aliases are registered dynamically via registerSeamAliases().
  // We declare the known ones explicitly for type safety. Unknown aliases
  // fall through via the catch-all index signature in PortalBridge.
  [key: string]: unknown;
}

// ---------- Vendor script globals ----------
declare const QRCode: {
  toCanvas: (
    canvas: HTMLCanvasElement,
    text: string,
    opts?: Record<string, unknown>,
  ) => Promise<void>;
  toDataURL: (text: string, opts?: Record<string, unknown>) => string;
};

// SheetJS (xlsx) — loaded via <script> on share.html
declare const XLSX: {
  read: (
    data: ArrayBuffer,
    opts?: Record<string, unknown>,
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (sheet: unknown, opts?: Record<string, unknown>) => Record<string, unknown>[];
    sheet_to_csv: (sheet: unknown, opts?: Record<string, unknown>) => string;
  };
};

// Mammoth (Word → HTML) — loaded via <script> on share.html
declare const mammoth: {
  convertToHtml: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

// pptx-preview — loaded via <script> on share.html
declare const pptxgen: unknown;

// ---------- Netlify runtime ----------
interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string>;
  path: string;
  queryStringParameters: Record<string, string> | null;
  body: string | null;
  isBase64Encoded: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// ---------- Utility types ----------
type Nullable<T> = T | null;
type Optional<T> = T | undefined;
type StringOrNumber = string | number;

// ---------- CallAPI types ----------
type ActionName = string;
type ActionPayload = unknown[];
type CallAPIResult<T = unknown> = Promise<{
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}>;

// ---------- i18n ----------
type LangCode = 'id' | 'jp';
type TranslationKey = string;
