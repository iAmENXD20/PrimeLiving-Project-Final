const https = require('https');
const TOKEN = process.env.SUPABASE_SERVICE_TOKEN || '';
const PROJECT = 'hruvhxolibpolgxxcdma';

function query(sql) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(d),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.message) reject(new Error(parsed.message));
          else resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(d);
    req.end();
  });
}

async function main() {
  // Change Karl Bautista -> Juan Dela Cruz
  const r = await query(
    `UPDATE tenants SET first_name = 'Juan', last_name = 'Dela Cruz' WHERE first_name = 'Karl' AND last_name = 'Bautista'`
  );
  console.log('Tenant name updated:', JSON.stringify(r));

  // Also update payments description that reference the old name if any
  const check = await query(
    `SELECT id, first_name, last_name FROM tenants WHERE first_name = 'Juan' AND last_name = 'Dela Cruz'`
  );
  console.log('Verified:', JSON.stringify(check));
}

main().catch(console.error);
