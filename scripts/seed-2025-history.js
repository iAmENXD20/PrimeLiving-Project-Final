const https = require('https');
const { randomUUID } = require('crypto');

const TOKEN = process.env.SUPABASE_SERVICE_TOKEN || '';
const PROJECT  = 'hruvhxolibpolgxxcdma';
const OWNER_ID = '95faecbe-0b0e-4ba1-9541-88b536ac4f23';
const APT_ID   = 'dffc52b6-1102-4d38-8af2-63c2220b3dd3';

const TENANTS = {
  henry:    { id: '6b4d001c-d474-4d83-b9ab-ac8a0a702044', unit: 'b806d110-f1ed-4800-ba27-029f20ae04fc', rent: 10000 },
  boots:    { id: 'fd7bfffc-0b48-4f51-941d-f43fc20dbf03', unit: 'c0d670b0-e9a9-43f4-acde-c36e2f1340d1', rent: 10000 },
  margaret: { id: '120f6f4b-eb5e-4a80-855a-7f8af48aa15d', unit: '42b47317-678b-49eb-8f37-6af470aac612', rent: 10000 },
  juanito:  { id: '205ac622-6bb3-4c5c-9078-770dc376a72b', unit: 'aa2da20a-4b8b-479c-9574-bb68c484118f', rent: 10000 },
};

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

const MODES = ['cash', 'gcash', 'bank_transfer'];
function pm(i) { return MODES[i % 3]; }
function pad2(n) { return String(n).padStart(2, '0'); }
function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
function monthName(y, m) {
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' });
}

// ─── Build payment schedule ────────────────────────────────────────────────
// Henry: Jan–Nov 2025 (already has Dec 2025 + 2026 data)
// Boots: Jan–Dec 2025 (already has Jan 2026+ data)
// Margaret: Aug–Dec 2025 + Jan 2026 (already has Feb 2026+ data)
// Juanito: Oct–Dec 2025 + Jan–Feb 2026 (already has Mar 2026+ data)

const schedule = [
  // Henry — 11 months (Jan–Nov 2025)
  ...Array.from({ length: 11 }, (_, i) => ({ t: 'henry',    y: 2025, m: i + 1,  payDay: 3 + (i % 5) })),
  // Boots — 12 months (Jan–Dec 2025)
  ...Array.from({ length: 12 }, (_, i) => ({ t: 'boots',    y: 2025, m: i + 1,  payDay: 2 + (i % 4) })),
  // Margaret — Aug–Dec 2025
  ...Array.from({ length: 5  }, (_, i) => ({ t: 'margaret', y: 2025, m: i + 8,  payDay: 4 + (i % 3) })),
  // Margaret — Jan 2026
  { t: 'margaret', y: 2026, m: 1, payDay: 3 },
  // Juanito — Oct–Dec 2025
  ...Array.from({ length: 3  }, (_, i) => ({ t: 'juanito',  y: 2025, m: i + 10, payDay: 3 + (i % 4) })),
  // Juanito — Jan–Feb 2026
  { t: 'juanito', y: 2026, m: 1, payDay: 5 },
  { t: 'juanito', y: 2026, m: 2, payDay: 4 },
];

async function main() {
  console.log(`\nInserting ${schedule.length} historical payment records (2025–2026)...\n`);
  let ok = 0, fail = 0;

  for (let i = 0; i < schedule.length; i++) {
    const { t, y, m, payDay } = schedule[i];
    const tenant   = TENANTS[t];
    const pf       = `${y}-${pad2(m)}-01`;
    const pt       = `${y}-${pad2(m)}-${pad2(lastDay(y, m))}`;
    const payDate  = `${y}-${pad2(m)}-${pad2(payDay)}T08:30:00Z`;
    const desc     = `Monthly Rent - ${monthName(y, m)} ${y}`;
    const mode     = pm(i);
    const id       = randomUUID();

    const sql = `
      INSERT INTO payments
        (id, apartmentowner_id, tenant_id, unit_id, apartment_id, amount,
         payment_date, status, description, payment_mode, receipt_url,
         verification_status, period_from, period_to, created_at)
      VALUES (
        '${id}', '${OWNER_ID}', '${tenant.id}', '${tenant.unit}',
        '${APT_ID}', ${tenant.rent}, '${payDate}', 'paid',
        '${desc}', '${mode}', NULL, 'approved',
        '${pf}', '${pt}', '2026-05-07T00:00:00Z'
      )
      ON CONFLICT DO NOTHING;
    `;

    try {
      await query(sql);
      console.log(`  ✓ [${t.padEnd(8)}] ${desc.padEnd(40)} (${mode})`);
      ok++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${desc} → ${err.message}`);
      fail++;
    }
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`  Inserted : ${ok}`);
  console.log(`  Failed   : ${fail}`);
  console.log(`  Total DB : ${27 + ok} payments`);
}

main();
