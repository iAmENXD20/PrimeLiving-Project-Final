const https = require('https');
const { randomUUID } = require('crypto');

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

// ─── Tenant + Unit map ────────────────────────────────────────────────────────
const TENANTS = {
  cathy:    { id: '1b03d4f6-d736-4094-9021-55b3f6c653c5', unit: '55b901ba-5619-4302-97fe-da032fc6a70c', rent: 10000 },
  henry:    { id: '6b4d001c-d474-4d83-b9ab-ac8a0a702044', unit: 'b806d110-f1ed-4800-ba27-029f20ae04fc', rent: 10000 },
  karl:     { id: 'c0b9caba-2bf0-4df3-b7a0-c5b12e330501', unit: '0cdf0640-7644-4ae2-9369-b92d004d1ef0', rent: 8500  },
  margaret: { id: '120f6f4b-eb5e-4a80-855a-7f8af48aa15d', unit: '42b47317-678b-49eb-8f37-6af470aac612', rent: 10000 },
  diane:    { id: '3eafe691-fb32-4c94-93e2-599faea556ff', unit: '7ae3840d-8194-407c-9333-b402061ebeb0', rent: 10000 },
  boots:    { id: 'fd7bfffc-0b48-4f51-941d-f43fc20dbf03', unit: 'c0d670b0-e9a9-43f4-acde-c36e2f1340d1', rent: 10000 },
  juanito:  { id: '205ac622-6bb3-4c5c-9078-770dc376a72b', unit: 'aa2da20a-4b8b-479c-9574-bb68c484118f', rent: 10000 },
};

// ─── Helper: build a payment row ─────────────────────────────────────────────
function row(tenant, from, to, status, mode, verification, paymentDate, desc) {
  const t = TENANTS[tenant];
  const paid = status === 'paid';
  return {
    id: randomUUID(),
    apartmentowner_id: OWNER_ID,
    tenant_id: t.id,
    unit_id: t.unit,
    apartment_id: APT_ID,
    amount: t.rent,
    payment_date: paid && paymentDate ? paymentDate : null,
    status,
    description: desc || 'Monthly Rent',
    payment_mode: mode || null,
    receipt_url: null,
    verification_status: verification || null,
    period_from: from,
    period_to: to,
    created_at: new Date().toISOString(),
  };
}

// ─── Simulation data ──────────────────────────────────────────────────────────
// Today: 2026-05-07
// Format:  row(tenant, period_from, period_to, status, mode, verification, payment_date, description)

const payments = [
  // ── CATHY MADULID (lease Mar 18 – Sep 18, 2026) ──────────────────────────
  row('cathy', '2026-03-18', '2026-04-17', 'paid',    'gcash', 'approved', '2026-03-20T08:30:00Z', 'Monthly Rent - March'),
  // April already exists (paid)
  row('cathy', '2026-05-18', '2026-06-17', 'pending', null,    null,        null, 'Monthly Rent - May'),   // awaiting payment

  // ── HENRY TRIBDINO (lease Dec 1, 2025 – Dec 1, 2026) ─────────────────────
  row('henry', '2025-12-01', '2025-12-31', 'paid',    'cash',         'approved', '2025-12-05T09:00:00Z', 'Monthly Rent - December 2025'),
  row('henry', '2026-01-01', '2026-01-31', 'paid',    'gcash',        'approved', '2026-01-03T10:15:00Z', 'Monthly Rent - January'),
  row('henry', '2026-02-01', '2026-02-28', 'paid',    'bank_transfer','approved', '2026-02-04T11:00:00Z', 'Monthly Rent - February'),
  row('henry', '2026-03-01', '2026-03-31', 'paid',    'cash',         'approved', '2026-03-02T08:45:00Z', 'Monthly Rent - March'),
  // April already exists (overdue)
  row('henry', '2026-05-01', '2026-05-31', 'pending', null, null, null, 'Monthly Rent - May'),             // awaiting payment

  // ── MARGARET MANGULABNAN (lease Feb 1, 2026 – Feb 1, 2027) ───────────────
  row('margaret', '2026-02-01', '2026-02-28', 'paid', 'bank_transfer', 'approved', '2026-02-03T09:30:00Z', 'Monthly Rent - February'),
  row('margaret', '2026-03-01', '2026-03-31', 'paid', 'gcash',         'approved', '2026-03-05T10:00:00Z', 'Monthly Rent - March'),
  // April already exists (2x overdue)
  row('margaret', '2026-05-01', '2026-05-31', 'overdue', null, null, null, 'Monthly Rent - May'),           // still overdue

  // ── DIANE ARCEGA (lease Apr 18, 2026 – Apr 18, 2027) ─────────────────────
  // April already exists (paid)
  row('diane', '2026-05-18', '2026-06-17', 'pending', null, null, null, 'Monthly Rent - May'),              // awaiting payment

  // ── BOOTS CASTRO (lease Jan 1 – Jul 1, 2026 ← ABOUT TO EXPIRE!) ──────────
  row('boots', '2026-01-01', '2026-01-31', 'paid', 'cash',         'approved', '2026-01-04T08:00:00Z', 'Monthly Rent - January'),
  row('boots', '2026-02-01', '2026-02-28', 'paid', 'gcash',        'approved', '2026-02-02T09:20:00Z', 'Monthly Rent - February'),
  row('boots', '2026-03-01', '2026-03-31', 'paid', 'bank_transfer','approved', '2026-03-03T10:10:00Z', 'Monthly Rent - March'),
  // April already exists (paid)
  row('boots', '2026-05-01', '2026-05-31', 'overdue', null, null, null, 'Monthly Rent - May'),              // overdue + lease almost expired

  // ── JUANITO MERCADO (lease Mar 18, 2026 – Mar 18, 2027) ──────────────────
  row('juanito', '2026-03-18', '2026-04-17', 'paid', 'bank_transfer', 'approved', '2026-03-20T11:30:00Z', 'Monthly Rent - March'),
  // April already exists (overdue)
  row('juanito', '2026-05-18', '2026-06-17', 'pending', null, null, null, 'Monthly Rent - May'),            // awaiting payment
];

async function main() {
  console.log(`\nInserting ${payments.length} simulation payment records...\n`);

  let inserted = 0;
  let failed = 0;

  for (const p of payments) {
    const sql = `
      INSERT INTO payments
        (id, apartmentowner_id, tenant_id, unit_id, apartment_id, amount,
         payment_date, status, description, payment_mode, receipt_url,
         verification_status, period_from, period_to, created_at)
      VALUES (
        '${p.id}',
        '${p.apartmentowner_id}',
        '${p.tenant_id}',
        '${p.unit_id}',
        '${p.apartment_id}',
        ${p.amount},
        ${p.payment_date ? `'${p.payment_date}'` : 'NULL'},
        '${p.status}',
        '${p.description}',
        ${p.payment_mode ? `'${p.payment_mode}'` : 'NULL'},
        NULL,
        ${p.verification_status ? `'${p.verification_status}'` : 'NULL'},
        '${p.period_from}',
        '${p.period_to}',
        '${p.created_at}'
      )
      ON CONFLICT DO NOTHING;
    `;
    try {
      await query(sql);
      console.log(`  ✓ [${p.status.toUpperCase().padEnd(7)}] ${p.description} (tenant: ${p.tenant_id.substring(0,8)})`);
      inserted++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${p.description} → ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Failed: ${failed}`);
  console.log('\nPayment status breakdown:');
  const counts = payments.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  Object.entries(counts).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
}

main().catch(console.error);
