import crypto from 'crypto';

// =============================================================================
// fcm-server.js — Helper untuk mengirim Push Notification via FCM HTTP v1 API
// =============================================================================

// Cache token untuk performa
let _oauthToken = null;
let _tokenExpiry = 0;

/**
 * Membuat JWT untuk menukar OAuth2 token dari Google API (tanpa dependency luar).
 */
function getGoogleAuthToken(serviceAccount) {
  return new Promise((resolve, reject) => {
    if (_oauthToken && Date.now() < _tokenExpiry) {
      return resolve(_oauthToken);
    }

    const header = { alg: 'RS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // 1 jam
    const claim = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: exp,
      iat: iat,
    };

    const toBase64Url = (obj) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const signatureInput = toBase64Url(header) + '.' + toBase64Url(claim);

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign
      .sign(serviceAccount.private_key, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const jwt = signatureInput + '.' + signature;

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString();

    fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.access_token) {
          _oauthToken = data.access_token;
          _tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
          resolve(_oauthToken);
        } else {
          reject(new Error('Gagal mendapatkan token: ' + JSON.stringify(data)));
        }
      })
      .catch(reject);
  });
}

/**
 * Mengirim Notifikasi via Firebase Cloud Messaging HTTP v1 API.
 * @param {string} token - FCM Token device tujuan
 * @param {string} title - Judul notifikasi
 * @param {string} body - Isi notifikasi
 * @param {string} url - URL tujuan saat notifikasi di-klik (opsional)
 */
async function sendPushNotification(token, title, body, url = '/') {
  const envRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!envRaw) return false;

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(envRaw);
    // Fix double-escaped newlines in private_key (freebuff-env bug)
    if (serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (e) {
    console.error('[FCM] Error parse FIREBASE_SERVICE_ACCOUNT');
    return false;
  }

  try {
    const accessToken = await getGoogleAuthToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const payload = buildPushPayload(token, title, body, url);

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[FCM] Send Error:', data);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[FCM] Catch Error:', e.message);
    return false;
  }
}

/**
 * Mengirim notifikasi ke daftar token. Token yang tidak valid akan di-return
 * agar bisa dihapus dari database.
 */
async function sendMulticast(tokens, title, body, url = '/') {
  const invalidTokens = [];
  for (let token of tokens) {
    if (!token) continue;
    const ok = await sendPushNotification(token, title, body, url);
    // Di API HTTP v1, token tidak valid akan menghasilkan error.
    if (!ok) invalidTokens.push(token);
  }
  return { successCount: tokens.length - invalidTokens.length, invalidTokens };
}

export function buildPushPayload(token, title, body, url = '/') {
  return {
    message: {
      token: String(token),
      data: { title: String(title || ''), body: String(body || ''), url: String(url || '/') },
      webpush: { headers: { Urgency: 'high' } },
    },
  };
}

export { sendPushNotification, sendMulticast };
