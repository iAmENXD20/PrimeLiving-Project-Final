const https = require('https');
const TOKEN = process.env.SUPABASE_SERVICE_TOKEN || '';
const PROJECT = process.env.SUPABASE_PROJECT_ID || 'hruvhxolibpolgxxcdma';

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
  // Set Margaret's lease_end to tomorrow (2026-05-08) to trigger expiry scenario
  const r = await query(
    `UPDATE units SET lease_end = '2026-05-08', contract_duration = 3 WHERE id = '42b47317-678b-49eb-8f37-6af470aac612'`
  );
  console.log('Margaret lease updated:', JSON.stringify(r));

  // Verify
  const check = await query(
    `SELECT name, lease_start, lease_end, contract_duration FROM units WHERE id = '42b47317-678b-49eb-8f37-6af470aac612'`
  );
  console.log('Current state:', JSON.stringify(check));
}

main().catch(console.error);
