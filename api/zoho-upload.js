const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwSfhr2jxN8zAHpvtebkOzffb5M5p4k9AW25vfQHIoqQfaKsTTHEVjFZJwVqTmvmYHx/exec';

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body || '{}'));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      success: true,
      message: 'MZJ Zoho upload proxy is running'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const webAppUrl = process.env.MZJ_DRIVE_UPLOAD_WEB_APP_URL || DEFAULT_WEB_APP_URL;
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || JSON.parse(await readRequestBody(req)));

    const upstream = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body
    });

    const text = await upstream.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (error) {
      json = {
        ok: upstream.ok,
        success: upstream.ok,
        raw: text
      };
    }

    return res.status(upstream.ok ? 200 : upstream.status || 500).json(json);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}
