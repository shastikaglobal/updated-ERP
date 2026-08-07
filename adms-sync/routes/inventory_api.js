const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Generic function to handle GET requests
async function handleGet(req, res, tableName, defaultSort = 'created_at DESC') {
  try {
    let { company_id } = req.query;
    if (!company_id) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [req.user.sub]);
      company_id = userRes.rows[0]?.company_id || '00000000-0000-0000-0000-00000000ae01';
    }
    
    // Some tables might not have company_id, but the ones we care about mostly do.
    let query = `SELECT * FROM ${tableName} WHERE deleted_at IS NULL`;
    let params = [];
    
    const tableColumns = await db.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [tableName]);
    const hasCompanyId = tableColumns.rows.some(r => r.column_name === 'company_id');
    
    if (hasCompanyId) {
      query += ` AND company_id = $1`;
      params.push(company_id);
    }
    
    if (defaultSort) {
      query += ` ORDER BY ${defaultSort}`;
    }
    
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(`DB Error (GET ${tableName}):`, err);
    res.status(500).json({ error: err.message });
  }
}

// ---------------- PRODUCTS ----------------
router.get('/products', requireAuth, async (req, res) => {
  handleGet(req, res, 'products', 'name ASC');
});

router.post('/products', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    // For arrays (bulk insert)
    if (Array.isArray(data)) {
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
        await db.query(`INSERT INTO products (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
      }
      return res.json({ success: true });
    }
    
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const { rows } = await db.query(`INSERT INTO products (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/products/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json({ success: true });
    const setClause = keys.map((k, i) => `"${k}" = $${i+1}`).join(', ');
    const values = Object.values(data);
    values.push(id);
    const { rows } = await db.query(`UPDATE products SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/products/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE products SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1 WHERE id = $2`, [req.user.sub, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------- WAREHOUSES ----------------
router.get('/warehouses', requireAuth, async (req, res) => {
  handleGet(req, res, 'warehouses', 'name ASC');
});

router.post('/warehouses', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
        await db.query(`INSERT INTO warehouses (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
      }
      return res.json({ success: true });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const { rows } = await db.query(`INSERT INTO warehouses (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/warehouses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json({ success: true });
    const setClause = keys.map((k, i) => `"${k}" = $${i+1}`).join(', ');
    const values = Object.values(data);
    values.push(id);
    const { rows } = await db.query(`UPDATE warehouses SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/warehouses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE warehouses SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1 WHERE id = $2`, [req.user.sub, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------- INVENTORY BATCHES ----------------
router.get('/inventory_batches', requireAuth, async (req, res) => {
  try {
    let { company_id } = req.query;
    if (!company_id) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [req.user.sub]);
      company_id = userRes.rows[0]?.company_id || '00000000-0000-0000-0000-00000000ae01';
    }
    
    // We want to join with products and warehouses
    const { rows } = await db.query(`
      SELECT b.*, 
             p.name as product_name, p.category as product_category, p.unit as product_unit,
             w.name as warehouse_name
      FROM inventory_batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.company_id = $1 AND b.deleted_at IS NULL
      ORDER BY b.created_at DESC
    `, [company_id]);
    
    // Re-shape to match frontend expectations
    const reshaped = rows.map(r => ({
      ...r,
      products: { name: r.product_name, category: r.product_category, unit: r.product_unit },
      warehouses: { name: r.warehouse_name }
    }));
    
    res.json(reshaped);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/inventory_batches', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
        await db.query(`INSERT INTO inventory_batches (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders})`, values);
      }
      return res.json({ success: true });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const { rows } = await db.query(`INSERT INTO inventory_batches (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/inventory_batches/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json({ success: true });
    const setClause = keys.map((k, i) => `"${k}" = $${i+1}`).join(', ');
    const values = Object.values(data);
    values.push(id);
    const { rows } = await db.query(`UPDATE inventory_batches SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------- AVAILABLE STOCK ----------------
router.get('/available_stock', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM available_stock WHERE deleted_at IS NULL');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/available_stock', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
        await db.query(`INSERT INTO available_stock (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders})`, values);
      }
      return res.json({ success: true });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const { rows } = await db.query(`INSERT INTO available_stock (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/available_stock/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json({ success: true });
    const setClause = keys.map((k, i) => `"${k}" = $${i+1}`).join(', ');
    const values = Object.values(data);
    values.push(id);
    const { rows } = await db.query(`UPDATE available_stock SET ${setClause} WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------- INVENTORY MOVEMENTS ----------------
router.get('/inventory_movements', requireAuth, async (req, res) => {
  // If table doesnt exist yet, it'll gracefully fail
  try {
    const { rows } = await db.query('SELECT * FROM stock_movements ORDER BY date DESC LIMIT 100');
    res.json(rows);
  } catch (err) { res.json([]); }
});

router.post('/inventory_movements', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
        await db.query(`INSERT INTO stock_movements (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders})`, values).catch(()=>null);
      }
      return res.json({ success: true });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    await db.query(`INSERT INTO stock_movements (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders})`, values);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------- DAMAGED STOCK ----------------
router.get('/damaged_stock', requireAuth, async (req, res) => {
  handleGet(req, res, 'damaged_stock', 'reported_date DESC');
});

router.post('/damaged_stock', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
        await db.query(`INSERT INTO damaged_stock (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders})`, values);
      }
      return res.json({ success: true });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const { rows } = await db.query(`INSERT INTO damaged_stock (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/damaged_stock/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json({ success: true });
    const setClause = keys.map((k, i) => `"${k}" = $${i+1}`).join(', ');
    const values = Object.values(data);
    values.push(id);
    const { rows } = await db.query(`UPDATE damaged_stock SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------- WAREHOUSE STOCK ----------------
router.get('/warehouse_stock', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM warehouse_stock WHERE deleted_at IS NULL');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/warehouse_stock', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
        await db.query(`INSERT INTO warehouse_stock (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders})`, values);
      }
      return res.json({ success: true });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const { rows } = await db.query(`INSERT INTO warehouse_stock (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/warehouse_stock/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) return res.json({ success: true });
    const setClause = keys.map((k, i) => `"${k}" = $${i+1}`).join(', ');
    const values = Object.values(data);
    values.push(id);
    const { rows } = await db.query(`UPDATE warehouse_stock SET ${setClause}, last_updated = NOW() WHERE id = $${values.length} RETURNING *`, values);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/export_containers/with-shipments — joined read for Container Loading
router.get('/export_containers/with-shipments', requireAuth, async (req, res) => {
  try {
    let query = `
      SELECT ec.*,
        es.shipment_number,
        es.origin_port,
        es.destination_port
      FROM export_containers ec
      LEFT JOIN export_shipments es ON ec.shipment_id = es.id
      ORDER BY ec.created_at DESC
    `;
    const { rows } = await db.query(query);
    const mapped = rows.map(r => ({
      ...r,
      export_shipments: { 
        shipment_number: r.shipment_number, 
        origin_port: r.origin_port, 
        destination_port: r.destination_port 
      }
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error GET export_containers/with-shipments:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
