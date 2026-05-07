const https = require('https');
const TOKEN = process.env.SUPABASE_SERVICE_TOKEN || '';
const PROJECT = 'hruvhxolibpolgxxcdma';
const OWNER_ID = '95faecbe-0b0e-4ba1-9541-88b536ac4f23';
const APT_ID   = 'dffc52b6-1102-4d38-8af2-63c2220b3dd3';

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
  // 1. List all units with occupancy
  const units = await query(`
    SELECT u.id, u.name, u.status, u.monthly_rent, u.lease_start, u.lease_end,
           t.id AS tenant_id, t.first_name, t.last_name
    FROM units u
    LEFT JOIN tenants t ON t.unit_id = u.id
    ORDER BY u.name
  `);
  console.log('\nAll Units:');
  units.forEach(u => console.log(
    u.id.substring(0, 8),
    u.name.padEnd(15),
    (u.first_name ? `${u.first_name} ${u.last_name}` : 'VACANT').padEnd(20),
    u.status,
    'lease_end:', u.lease_end || 'none'
  ));

  // 2. Get Nerma Hernandez tenant ID
  const nerma = await query(`SELECT id, first_name, last_name, unit_id, apartmentowner_id FROM tenants WHERE first_name='Nerma' AND last_name='Hernandez'`);
  console.log('\nNerma:', JSON.stringify(nerma));

  // 3. Get Juan Dela Cruz unit ID
  const juan = await query(`SELECT t.id, t.first_name, t.last_name, t.unit_id, u.id AS unit_uuid, u.name AS unit_name FROM tenants t LEFT JOIN units u ON t.unit_id=u.id WHERE t.first_name='Juan' AND t.last_name='Dela Cruz'`);
  console.log('\nJuan:', JSON.stringify(juan));

  // 4. Find a vacant unit or create one for Nerma
  const vacant = units.filter(u => !u.first_name);
  console.log('\nVacant units:', vacant.map(u => u.name + ' (' + u.id.substring(0,8) + ')'));
}

main().catch(console.error);
