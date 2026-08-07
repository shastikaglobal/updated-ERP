const jwt = require('jsonwebtoken');
const db = require('./db'); // Reusing adms-sync db connection

async function run() {
  const SECRET = '15c8fff598a88d136378bc028951d8109b3d56178adf9ba8f51338b2a41018f2';
  const token = jwt.sign({ sub: 'd5496f84-bd5f-49f2-aee8-28fa493287b3' }, SECRET, { expiresIn: '1h' });

  // Get a real farmer ID
  const { rows } = await db.query('SELECT id FROM farmers LIMIT 1');
  if (rows.length === 0) {
    console.log("No farmers found!");
    process.exit(1);
  }
  const realFarmerId = rows[0].id;

  const payload = JSON.stringify({
    farmer_id: realFarmerId,
    crop: 'Test Crop',
    start_date: '2026-01-01',
    end_date: '2026-12-31'
  });

  const res = await fetch('http://localhost:8082/api/farmers/contracts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'accessToken=' + token
    },
    body: payload
  });
  
  const data = await res.text();
  console.log('STATUS:', res.status);
  console.log('RESPONSE:', data);
  process.exit(0);
}

run();
