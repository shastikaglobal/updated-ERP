import sys

with open('adms-sync/routes/farmers.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_part = """router.post('/contracts', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, crop, status, start_date, end_date, terms } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    const { rows } = await db.query(
      `INSERT INTO contract_farming (farmer_id, company_id, crop, status, start_date, end_date, terms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [farmer_id, compId, crop, status, start_date, end_date, terms, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});"""

new_part = """router.post('/contracts', requireAuth, async (req, res) => {
  try {
    const { id, farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url } = req.body;
    const { rows } = await db.query(
      `INSERT INTO contract_farming (id, farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});"""

# Handle both LF and CRLF
content = content.replace(old_part.replace('\n', '\r\n'), new_part.replace('\n', '\r\n'))
content = content.replace(old_part, new_part)

with open('adms-sync/routes/farmers.js', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Patched successfully")
