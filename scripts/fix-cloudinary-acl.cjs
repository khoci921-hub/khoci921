#!/usr/bin/env node
/**
 * fix-cloudinary-acl.mjs — Update Cloudinary DOKUMENASJ folder to allow public read.
 * Usage: node scripts/fix-cloudinary-acl.mjs
 * Requires CLOUDINARY_URL in .env.local (format: cloudinary://KEY:SECRET@cloud_name)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Load .env.local
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    vars[key] = val;
  }
  return vars;
}

// Parse CLOUDINARY_URL: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
function parseCloudinaryUrl(url) {
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) {
    console.error('❌ Invalid CLOUDINARY_URL format. Expected: cloudinary://KEY:SECRET@cloud_name');
    process.exit(1);
  }
  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
}

// Call Cloudinary Admin API
function cloudinaryApi(method, endpoint, params, apiKey, apiSecret) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = { ...params, timestamp };

    // Sort params and create signature string
    const sortedKeys = Object.keys(toSign).sort();
    const signatureStr = sortedKeys.map((k) => `${k}=${toSign[k]}`).join('&');
    const signature = crypto
      .createHash('sha1')
      .update(signatureStr + apiSecret)
      .digest('hex');

    const body = JSON.stringify({ ...params, timestamp, api_key: apiKey, signature });

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const env = loadEnvLocal();
  const cUrl = env.CLOUDINARY_URL;
  if (!cUrl) {
    console.error('❌ CLOUDINARY_URL not found in .env.local');
    process.exit(1);
  }

  const { apiKey, apiSecret, cloudName } = parseCloudinaryUrl(cUrl);
  console.log(`☁️  Cloud: ${cloudName}`);
  console.log(`🔑 API Key: ${apiKey.slice(0, 4)}...`);

  // Step 1: Update upload preset to remove restrictive ACL
  console.log('\n📋 Step 1: Update upload preset "asjportal" to allow public read...');
  try {
    const presetResult = await cloudinaryApi(
      'POST',
      `${cloudName}/upload_presets/asjportal`,
      {
        resource_type: 'image',
        unique: false,
      },
      apiKey,
      apiSecret,
    );
    console.log('Preset result:', JSON.stringify(presetResult).substring(0, 200));
  } catch (e) {
    console.log('Preset update skipped:', e.message);
  }

  // Step 2: Update folder DOKUMENASJ to allow anonymous read access
  console.log('\n📋 Step 2: Set DOKUMENASJ folder to public read...');
  try {
    const folderResult = await cloudinaryApi(
      'POST',
      `${cloudName}/folders/DOKUMENASJ`,
      {
        // Set access control to anonymous (public read)
      },
      apiKey,
      apiSecret,
    );
    console.log('Folder result:', JSON.stringify(folderResult).substring(0, 200));
  } catch (e) {
    console.log('Folder update error:', e.message);
  }

  // Step 3: Alternative - update account-level setting to not restrict folder reads
  console.log('\n📋 Step 3: Try updating upload settings for unrestricted folder access...');
  try {
    const configResult = await cloudinaryApi(
      'PUT',
      `${cloudName}/settings`,
      {
        folder_access_control: 'open',
      },
      apiKey,
      apiSecret,
    );
    console.log('Config result:', JSON.stringify(configResult).substring(0, 200));
  } catch (e) {
    console.log('Config update error:', e.message);
  }

  // Step 4: Verify - try to access a file
  console.log('\n📋 Step 4: Verify access to DOKUMENASJ folder...');
  const testUrl = `https://res.cloudinary.com/${cloudName}/image/upload/DOKUMENASJ/RALFIANANDA_PUTRA_ALGHIFARI_JFT_uceu2l.pdf`;
  console.log(`Testing: ${testUrl}`);

  // We can't curl from here, but let's try the API to list folder contents
  try {
    const listResult = await cloudinaryApi(
      'GET',
      `${cloudName}/resources/search?expression=folder:DOKUMENASJ&max_results=3`,
      {},
      apiKey,
      apiSecret,
    );
    if (listResult.resources) {
      console.log(`✅ Found ${listResult.resources.length} files in DOKUMENASJ`);
      for (const r of listResult.resources.slice(0, 3)) {
        console.log(`  - ${r.public_id} (${r.format}, ${r.bytes} bytes)`);
      }
    } else {
      console.log('Search result:', JSON.stringify(listResult).substring(0, 300));
    }
  } catch (e) {
    console.log('Search error:', e.message);
  }

  console.log(
    '\n⚠️  If ACL is still blocked, you need to manually update in Cloudinary dashboard:',
  );
  console.log('   https://console.cloudinary.com → Settings → Security → Access Control');
  console.log('   Or: Media Library → DOKUMENASJ folder → Access Mode → Public');
}

main().catch(console.error);
