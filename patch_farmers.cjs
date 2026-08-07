const fs = require('fs');

let content = fs.readFileSync('adms-sync/routes/farmers.js', 'utf8');

const oldPart = `router.post('/contracts', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, crop, status, start_date, end_date, terms } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    const { rows } = await db.query(
      \`INSERT INTO contract_farming (farmer_id, company_id, crop, status, start_date, end_date, terms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *\`,
      [farmer_id, compId, crop, status, start_date, end_date, terms, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

const newPart = `router.post('/contracts', requireAuth, async (req, res) => {
  try {
    const { id, farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url } = req.body;
    const { rows } = await db.query(
      \`INSERT INTO contract_farming (id, farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *\`,
      [id, farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

content = content.replace(oldPart.replace(/\n/g, '\r\n'), newPart.replace(/\n/g, '\r\n'));
content = content.replace(oldPart, newPart);

fs.writeFileSync('adms-sync/routes/farmers.js', content);
console.log('Patched successfully');
