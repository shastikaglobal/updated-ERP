const fs = require('fs');

const content = fs.readFileSync('/var/www/adms-sync/routes/farmers.js', 'utf8');

const startIdx = content.indexOf("router.post('/contracts'");
const nextRouteIdx = content.indexOf("// --- COMMITMENTS ---", startIdx);

if (startIdx === -1 || nextRouteIdx === -1) {
  console.log("Could not find blocks");
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after = content.substring(nextRouteIdx);

const newRoute = `router.post('/contracts', requireAuth, async (req, res) => {
  try {
    const { id, farmer_id, contract_number, crop_name, crop, agreed_quantity, quantity, agreed_price, price, start_date, end_date, status, document_url } = req.body;
    
    const final_crop = crop_name || crop || 'Unknown';
    const final_quantity = agreed_quantity || quantity || 0;
    const final_price = agreed_price || price || 0;
    const final_contract_number = contract_number || 'CN-' + Date.now();
    
    let query = \`INSERT INTO contract_farming (farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *\`;
    let values = [farmer_id, final_contract_number, final_crop, final_quantity, final_price, start_date, end_date, status || 'Draft', document_url];
    
    if (id) {
       query = \`INSERT INTO contract_farming (id, farmer_id, contract_number, crop_name, agreed_quantity, agreed_price, start_date, end_date, status, document_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *\`;
       values = [id, farmer_id, final_contract_number, final_crop, final_quantity, final_price, start_date, end_date, status || 'Draft', document_url];
    }
    
    const { rows } = await db.query(query, values);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

`;

fs.writeFileSync('/var/www/adms-sync/routes/farmers.js', before + newRoute + after, 'utf8');
console.log('patched successfully');
