const https = require('https');
const TOKEN = process.env.SUPABASE_SERVICE_TOKEN || '';
const PROJECT  = 'hruvhxolibpolgxxcdma';
const OWNER_ID = '95faecbe-0b0e-4ba1-9541-88b536ac4f23';
const APT_ID   = 'dffc52b6-1102-4d38-8af2-63c2220b3dd3';

// IDs from DB
const NERMA_ID   = '879f18e2-c83d-44dd-bef7-65edc5b89a3a';
const ROOM103_ID = '091e7a62-77a2-4af9-a105-a6ae920d3702'; // Room 103
const JUAN_UNIT  = '0cdf0640-7644-4ae2-9369-b92d004d1ef0'; // Room ni Karl

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
  console.log('Setting up expiry scenario for Juan Dela Cruz & Nerma Hernandez...\n');

  // 1. Update Juan's unit (Room ni Karl) lease_end to tomorrow
  let r = await query(`UPDATE units SET lease_end='2026-05-08', contract_duration=7 WHERE id='${JUAN_UNIT}'`);
  console.log('✓ Juan lease updated:', r.length === 0 ? 'OK' : JSON.stringify(r));

  // 2. Activate Room 103 and set it up for Nerma
  r = await query(`
    UPDATE units
    SET status='active',
        monthly_rent=9500,
        lease_start='2026-02-01',
        lease_end='2026-05-08',
        contract_duration=3,
        apartmentowner_id='${OWNER_ID}',
        apartment_id='${APT_ID}'
    WHERE id='${ROOM103_ID}'
  `);
  console.log('✓ Room 103 activated:', r.length === 0 ? 'OK' : JSON.stringify(r));

  // 3. Assign Nerma to Room 103
  r = await query(`
    UPDATE tenants
    SET unit_id='${ROOM103_ID}',
        apartment_id='${APT_ID}',
        status='active',
        move_in_date='2026-02-01'
    WHERE id='${NERMA_ID}'
  `);
  console.log('✓ Nerma assigned to Room 103:', r.length === 0 ? 'OK' : JSON.stringify(r));

  // 4. Verify
  const check = await query(`
    SELECT t.first_name, t.last_name, t.status, u.name, u.lease_start, u.lease_end, u.contract_duration
    FROM tenants t LEFT JOIN units u ON t.unit_id=u.id
    WHERE t.first_name IN ('Juan','Nerma')
    ORDER BY t.first_name
  `);
  console.log('\nVerification:');
  check.forEach(r => console.log(
    `  ${r.first_name} ${r.last_name}`.padEnd(20),
    (r.name || '—').padEnd(14),
    `lease_end: ${r.lease_end}`,
    `| status: ${r.status}`
  ));
}

main().catch(console.error);
