const jwt = require('jsonwebtoken');

const SECRET = '15c8fff598a88d136378bc028951d8109b3d56178adf9ba8f51338b2a41018f2';
const token = jwt.sign({ sub: 'd5496f84-bd5f-49f2-aee8-28fa493287b3' }, SECRET, { expiresIn: '1h' });

const payload = JSON.stringify({
  farmer_id: 'a8f5c3a3-a7d1-4b13-9111-dfab5cd5a122',
  crop: 'Test',
  start_date: '2026-01-01',
  end_date: '2026-12-31'
});

async function run() {
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
}

run();
