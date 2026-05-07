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
  // List all tenants with their unit lease info
  const rows = await query(`
    SELECT t.id AS tenant_id, t.first_name, t.last_name, t.status,
           u.id AS unit_id, u.name AS unit_name, u.lease_start, u.lease_end, u.contract_duration
    FROM tenants t
    LEFT JOIN units u ON t.unit_id = u.id
    ORDER BY t.last_name, t.first_name
  `);
  rows.forEach(r => console.log(
    `${r.first_name} ${r.last_name}`.padEnd(25),
    (r.unit_name || '—').padEnd(12),
    `lease_end: ${r.lease_end || '—'}`.padEnd(25),
    `status: ${r.status}`
  ));
}

main().catch(console.error);
