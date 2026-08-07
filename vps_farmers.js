const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/farmers
router.get('/', requireAuth, async (req, res) => {
  try {
    let { company_id } = req.query;
    console.log(`[GET /api/farmers] Received company_id query parameter: '${company_id}', type: ${typeof company_id}`);
    if (!company_id || company_id === 'undefined' || company_id === 'null') {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [req.user.sub]);
      if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
        company_id = userRes.rows[0].company_id;
      } else {
        company_id = '00000000-0000-0000-0000-00000000ae01';
      }
      console.log(`[GET /api/farmers] company_id was missing, resolved to: ${company_id}`);
    }

// Supabase sync removed

    const userProfRes = await db.query('SELECT role, full_name FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    let query = `
      SELECT f.*, 
             CASE WHEN c.id IS NOT NULL THEN 'converted' ELSE 'active' END as conversion_status
      FROM farmers f
      LEFT JOIN customers c ON c.farmer_id = f.id
      WHERE f.company_id = $1 AND f.is_deleted IS NOT TRUE
    `;
    const params = [company_id];

    if (!isAdmin) {
      query += ` AND f.created_by = $2`;
      params.push(req.user.sub);
    }
    
    query += ` ORDER BY f.created_at DESC`;

    const { rows } = await db.query(query, params);
    
    console.log(`[GET /api/farmers] User ID: ${req.user.sub}, Role: ${userRole}. Retrieved ${rows.length} records.`);

    res.json(rows);
  } catch (err) {
    console.error('DB Error (get farmers):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// POST /api/farmers
router.post('/', requireAuth, async (req, res) => {
  try {
    let { company_id, full_name, email, phone, country, district, primary_crops, is_active } = req.body;
    
    if (!company_id) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [req.user.sub]);
      if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
        company_id = userRes.rows[0].company_id;
      } else {
        company_id = '00000000-0000-0000-0000-00000000ae01';
      }
      console.log(`[POST /api/farmers] company_id was missing, resolved to: ${company_id}`);
    }

    if (!full_name) {
      return res.status(400).json({ error: 'full_name is required' });
    }

    const userProfRes = await db.query('SELECT full_name FROM profiles WHERE id = $1', [req.user.sub]);
    const createdByName = userProfRes.rows.length > 0 ? userProfRes.rows[0].full_name : 'Unknown User';

    console.log(`[POST /api/farmers] Creating farmer for User ID: ${req.user.sub} (${createdByName})`);

    const { rows } = await db.query(
      `INSERT INTO farmers (company_id, full_name, email, phone, country, district, primary_crops, is_active, created_by, created_by_name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [company_id, full_name, email, phone, country, district, primary_crops, is_active ?? true, req.user.sub, createdByName]
    );

    const newFarmer = rows[0];
    console.log(`[POST /api/farmers] Successfully created farmer with created_by: ${newFarmer.created_by}`);

    res.status(201).json(newFarmer);
  } catch (err) {
    console.error('DB Error (create farmer):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// GET /api/farmers/converted
router.get('/converted', requireAuth, async (req, res) => {
  try {
    let { company_id } = req.query;
    if (!company_id) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [req.user.sub]);
      if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
        company_id = userRes.rows[0].company_id;
      } else {
        company_id = '00000000-0000-0000-0000-00000000ae01';
      }
      console.log(`[GET /api/farmers/converted] company_id was missing, resolved to: ${company_id}`);
    }
    const { rows } = await db.query(
      `SELECT f.id FROM farmers f 
       JOIN customers c ON c.farmer_id = f.id 
       WHERE f.company_id = $1 AND f.is_deleted IS NOT TRUE`,
      [company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('DB Error (get converted farmers):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// GET /api/farmers/kyc
router.get('/kyc', requireAuth, async (req, res) => {
  try {
    let { company_id } = req.query;
    if (!company_id) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [req.user.sub]);
      if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
        company_id = userRes.rows[0].company_id;
      } else {
        company_id = '00000000-0000-0000-0000-00000000ae01';
      }
    }

    const userProfRes = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    let query = `
      SELECT k.* 
      FROM farmer_kyc k
      INNER JOIN farmers f ON f.id = k.farmer_id
      WHERE f.company_id = $1
    `;
    const params = [company_id];

    if (!isAdmin) {
      query += ` AND f.created_by = $2`;
      params.push(req.user.sub);
    }

    const { rows } = await db.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error('DB Error (get farmer_kyc):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// POST /api/farmers/kyc
router.post('/kyc', requireAuth, async (req, res) => {
  try {
    const { farmer_id, aadhaar, pan, status } = req.body;

    const userProfRes = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    // Check ownership
    const checkOwner = await db.query('SELECT created_by FROM farmers WHERE id = $1', [farmer_id]);
    if (checkOwner.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    if (!isAdmin && checkOwner.rows[0].created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden: You do not own this record' });
    }
    
    // Upsert logic: Delete existing for this farmer
    await db.query(`DELETE FROM farmer_kyc WHERE farmer_id = $1`, [farmer_id]);

    const dbStatus = status === 'Completed' ? 'Approved' : 'Pending';
    
    if (aadhaar) {
      await db.query(
        `INSERT INTO farmer_kyc (farmer_id, document_type, document_number, status) VALUES ($1, 'Aadhaar', $2, $3)`,
        [farmer_id, aadhaar, dbStatus]
      );
    }
    
    if (pan) {
      await db.query(
        `INSERT INTO farmer_kyc (farmer_id, document_type, document_number, status) VALUES ($1, 'PAN', $2, $3)`,
        [farmer_id, pan, dbStatus]
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('DB Error (post farmer_kyc):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});
// GET /api/farmers/kyc/:id
router.get('/kyc/:id', requireAuth, async (req, res) => {
  try {
    const farmer_id = req.params.id;
    
    // Check ownership
    const userProfRes = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    const checkOwner = await db.query('SELECT created_by FROM farmers WHERE id = $1', [farmer_id]);
    if (checkOwner.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    if (!isAdmin && checkOwner.rows[0].created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden: You do not own this record' });
    }

    const { rows } = await db.query(`SELECT * FROM farmer_kyc WHERE farmer_id = $1`, [farmer_id]);
    
    const record = { id: farmer_id, farmer_id: farmer_id, aadhaar: '', pan: '', bank_account: '', ifsc: '', doc_urls: {}, status: 'Pending' };
    
    rows.forEach(row => {
      if (row.document_type === 'Aadhaar') record.aadhaar = row.document_number;
      if (row.document_type === 'PAN') record.pan = row.document_number;
      if (row.document_type === 'Bank Account') record.bank_account = row.document_number;
      if (row.document_type === 'IFSC') record.ifsc = row.document_number;
      if (row.document_type === 'doc_urls') {
        try { record.doc_urls = JSON.parse(row.document_number); } catch(e){}
      }
      if (row.status === 'Approved') record.status = 'Completed';
    });
    
    res.json(record);
  } catch (err) {
    console.error('DB Error (get farmer_kyc by id):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// PUT /api/farmers/kyc/:id
router.put('/kyc/:id', requireAuth, async (req, res) => {
  try {
    const farmer_id = req.params.id;
    const { aadhaar, pan, bank_account, ifsc, doc_urls, status } = req.body;

    const userProfRes = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    // Check ownership
    const checkOwner = await db.query('SELECT created_by FROM farmers WHERE id = $1', [farmer_id]);
    if (checkOwner.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    if (!isAdmin && checkOwner.rows[0].created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden: You do not own this record' });
    }
    
    // Delete existing EAV records for this farmer to rebuild them cleanly
    await db.query(`DELETE FROM farmer_kyc WHERE farmer_id = $1`, [farmer_id]);

    const dbStatus = status === 'Completed' ? 'Approved' : 'Pending';
    
    if (aadhaar) {
      await db.query(`INSERT INTO farmer_kyc (farmer_id, document_type, document_number, status) VALUES ($1, 'Aadhaar', $2, $3)`, [farmer_id, aadhaar, dbStatus]);
    }
    if (pan) {
      await db.query(`INSERT INTO farmer_kyc (farmer_id, document_type, document_number, status) VALUES ($1, 'PAN', $2, $3)`, [farmer_id, pan, dbStatus]);
    }
    if (bank_account) {
      await db.query(`INSERT INTO farmer_kyc (farmer_id, document_type, document_number, status) VALUES ($1, 'Bank Account', $2, $3)`, [farmer_id, bank_account, dbStatus]);
    }
    if (ifsc) {
      await db.query(`INSERT INTO farmer_kyc (farmer_id, document_type, document_number, status) VALUES ($1, 'IFSC', $2, $3)`, [farmer_id, ifsc, dbStatus]);
    }
    if (doc_urls) {
      await db.query(`INSERT INTO farmer_kyc (farmer_id, document_type, document_number, status) VALUES ($1, 'doc_urls', $2, $3)`, [farmer_id, JSON.stringify(doc_urls), dbStatus]);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('DB Error (put farmer_kyc):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// GET /api/farmers/:id
router.get('/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) { return res.status(400).json({ error: "Invalid ID format" }); }
    const userProfRes = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    const { rows } = await db.query(
      `SELECT * FROM farmers WHERE id = $1 AND is_deleted IS NOT TRUE`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    if (!isAdmin && rows[0].created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden: You do not own this record' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('DB Error (get farmer by id):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// PUT /api/farmers/:id
router.put('/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, country, district, primary_crops, is_active, notes, bank_account, state, village, code, verification_status, farm_area } = req.body;
    
    const userProfRes = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    // Check ownership
    const checkOwner = await db.query('SELECT created_by FROM farmers WHERE id = $1', [id]);
    if (checkOwner.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    if (!isAdmin && checkOwner.rows[0].created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden: You do not own this record' });
    }

    const { rows } = await db.query(
      `UPDATE farmers SET 
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        country = COALESCE($4, country),
        district = COALESCE($5, district),
        primary_crops = COALESCE($6, primary_crops),
        is_active = COALESCE($7, is_active),
        notes = COALESCE($8, notes),
        bank_account = COALESCE($9, bank_account),
        state = COALESCE($10, state),
        village = COALESCE($11, village),
        code = COALESCE($12, code),
        updated_at = NOW()
       WHERE id = $13 RETURNING *`,
      [full_name, email, phone, country, district, primary_crops, is_active, notes, bank_account, state, village, code, id, verification_status, farm_area]
    );

    const updatedFarmer = rows[0];

    res.json(updatedFarmer);
  } catch (err) {
    console.error('DB Error (update farmer):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// DELETE /api/farmers/:id
router.delete('/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const userProfRes = await db.query('SELECT role FROM profiles WHERE id = $1', [req.user.sub]);
    const userRole = userProfRes.rows.length > 0 ? userProfRes.rows[0].role : 'employee';
    const isAdmin = ['admin', 'manager', 'director'].includes(userRole?.toLowerCase());

    // Check ownership
    const checkOwner = await db.query('SELECT created_by FROM farmers WHERE id = $1', [id]);
    if (checkOwner.rows.length === 0) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    if (!isAdmin && checkOwner.rows[0].created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden: You do not own this record' });
    }

    const { rows } = await db.query(
      `UPDATE farmers SET is_deleted = true, is_active = false, deleted_at = NOW(), deleted_by = $1 WHERE id = $2 RETURNING id`,
      [req.user.sub, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('DB Error (delete farmer):', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// POST /api/farmers/:id/convert - Convert a farmer record into a customer
router.post('/:id/convert', requireAuth, async (req, res) => {
  const farmerId = req.params.id;
  const { company_id, name, email, country, phone, notes } = req.body;

  if (!company_id) {
    return res.status(400).json({ error: 'company_id is required' });
  }

  try {
    let { rows: farmerRows } = await db.query(
      `SELECT id, company_id, full_name, email, phone, country, notes, is_deleted FROM farmers WHERE id = $1`,
      [farmerId]
    );

    if (farmerRows.length === 0 || farmerRows[0].is_deleted) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const farmer = farmerRows[0];
    const customerEmail = (email || farmer.email || '').trim();

    // Check if customer with this farmer_id already exists (most reliable)
    const { rows: existingByFarmer } = await db.query(
      `SELECT * FROM customers WHERE company_id = $1 AND farmer_id = $2 LIMIT 1`,
      [company_id, farmerId]
    );

    let customerRecord = null;

    if (existingByFarmer.length > 0) {
      customerRecord = existingByFarmer[0];
      console.log(`[Sync] Farmer ${farmerId} already converted to customer ${customerRecord.id}. Linking to CRM leads...`);
    } else {
      // Check if a customer with the same email exists in VPS DB
      let existingVpsCust = null;
      if (customerEmail) {
        const { rows } = await db.query(
          `SELECT * FROM customers WHERE company_id = $1 AND email = $2 LIMIT 1`,
          [company_id, customerEmail]
        );
        if (rows.length > 0) {
          existingVpsCust = rows[0];
        }
      }

      const hasOtherFarmer = existingVpsCust && existingVpsCust.farmer_id;

      if (existingVpsCust && !hasOtherFarmer) {
        console.log(`[Sync] Customer with email ${customerEmail} already exists and is not linked to another farmer. Connecting farmer ${farmerId} to this customer...`);
        
        // Use existing ID
        const targetId = existingVpsCust.id;

        // Update local VPS customer to set farmer_id
        const { rows } = await db.query(
          `UPDATE customers SET farmer_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [farmerId, targetId]
        );
        existingVpsCust = rows[0];

        customerRecord = existingVpsCust;
      } else {
        // Create new customer record
        // If a customer with this email already exists in the company, set email to null to avoid unique key violation
        const insertEmail = existingVpsCust ? null : customerEmail;

        // Insert into local VPS database
        const { rows: insertedRows } = await db.query(
          `INSERT INTO customers (company_id, name, email, country, phone, notes, farmer_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            company_id,
            name || farmer.full_name,
            insertEmail || null,
            country || farmer.country || null,
            phone || farmer.phone || null,
            notes || farmer.notes || null,
            farmerId,
          ]
        );

        customerRecord = insertedRows[0];
      }
    }

    // Now, also connect/upsert this converted customer to the CRM leads database so it shows up in Customer Database page!
    if (customerRecord) {
      // Check if a lead with same email or company name exists
      let existingLead = null;
      if (customerEmail) {
        const { rows } = await db.query(
          `SELECT id, stage FROM leads WHERE company_id = $1 AND email = $2 AND is_deleted IS NOT TRUE LIMIT 1`,
          [company_id, customerEmail]
        );
        if (rows.length > 0) {
          existingLead = rows[0];
        }
      }

      if (!existingLead) {
        const { rows } = await db.query(
          `SELECT id, stage FROM leads WHERE company_id = $1 AND company_name = $2 AND is_deleted IS NOT TRUE LIMIT 1`,
          [company_id, customerRecord.name]
        );
        if (rows.length > 0) {
          existingLead = rows[0];
        }
      }

      if (existingLead) {
        console.log(`[Sync] Existing lead found for this customer: ${existingLead.id}. Updating stage to Client Successfully Acquired...`);
        // Update stage in VPS DB
        await db.query(
          `UPDATE leads SET stage = 'Client Successfully Acquired', updated_at = NOW() WHERE id = $1`,
          [existingLead.id]
        );
      } else {
        console.log(`[Sync] No existing lead found. Creating a corresponding lead record for CRM Customer Database...`);
        
        // Insert into leads in VPS DB
        const leadId = customerRecord.id; // Sync the IDs to keep them aligned
        await db.query(
          `INSERT INTO leads (id, company_id, company_name, contact_name, country, email, mobile, phone, stage, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Client Successfully Acquired', NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET stage = 'Client Successfully Acquired', updated_at = NOW()`,
          [
            leadId,
            company_id,
            customerRecord.name,
            customerRecord.name,
            customerRecord.country || null,
            customerRecord.email || null,
            customerRecord.phone || null,
            customerRecord.phone || null,
          ]
        );
      }
    }

    return res.status(200).json(customerRecord);
  } catch (err) {
    console.error('DB Error (convert farmer):', err);
    return res.status(500).json({ error: err.message || 'Failed to convert farmer to customer' });
  }
});



// --- FARM VISITS ---
router.get('/visits', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM farm_visits ORDER BY visit_date DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/visits', requireAuth, async (req, res) => {
  try {
    const { id, farmer_id, date, status, purpose, notes, visited_by } = req.body;
    const { rows } = await db.query(
      `INSERT INTO farm_visits (farmer_id, visit_date, status, purpose, notes, visited_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [farmer_id, date, status, purpose || 'Farm Visit', notes || '', visited_by || 'Admin User']
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/visits/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM farm_visits WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CONTRACT FARMING ---
router.get('/contracts', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM contract_farming ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/contracts', requireAuth, async (req, res) => {
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
});

// --- COMMITMENTS ---
router.get('/commitments', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM commitments WHERE company_id = $1 ORDER BY created_at DESC', [company_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/commitments', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, crop, status, quantity, price_per_unit, delivery_date } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    const { rows } = await db.query(
      `INSERT INTO commitments (farmer_id, company_id, crop, status, quantity, price_per_unit, delivery_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [farmer_id, compId, crop, status, quantity, price_per_unit, delivery_date, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- COLLECTIONS ---
router.get('/collections', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM collections WHERE company_id = $1 ORDER BY created_at DESC', [company_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/collections', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, crop, status, quantity_collected, quality_grade, collection_date } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    const { rows } = await db.query(
      `INSERT INTO collections (farmer_id, company_id, crop, status, quantity_collected, quality_grade, collection_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [farmer_id, compId, crop, status, quantity_collected, quality_grade, collection_date, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PAYOUTS ---
router.get('/payouts', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM payouts WHERE company_id = $1 ORDER BY created_at DESC', [company_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/payouts', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, amount, status, payout_date, payment_date, notes } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    const finalDate = payment_date || payout_date || new Date().toISOString();
    const { rows } = await db.query(
      `INSERT INTO payouts (farmer_id, company_id, amount, status, payment_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [farmer_id, compId, amount, status || 'Pending', finalDate, notes || null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RATINGS ---
router.get('/ratings', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM farmer_ratings WHERE company_id = $1 ORDER BY created_at DESC', [company_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ratings', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, score, review } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    const { rows } = await db.query(
      `INSERT INTO farmer_ratings (farmer_id, company_id, score, review, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [farmer_id, compId, score, review || null, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DOCUMENTS ---
router.get('/documents', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM farmer_documents ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/documents', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, doc_name, doc_type, url } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    const { rows } = await db.query(
      `INSERT INTO farmer_documents (farmer_id, company_id, doc_name, doc_type, url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [farmer_id, compId, doc_name, doc_type, url, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TICKETS (SUPPORT) ---
router.get('/tickets', requireAuth, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id required' });
    const { rows } = await db.query('SELECT * FROM farmer_support WHERE company_id = $1 ORDER BY created_at DESC', [company_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const { farmer_id, company_id, issue, issue_category, description, status, resolution, priority } = req.body;
    let compId = company_id;
    if (!compId) {
      const userRes = await db.query('SELECT company_id FROM profiles WHERE id = $1', [req.user.sub]);
      compId = userRes.rows[0]?.company_id;
    }
    // Support both legacy 'issue' field and new issue_category+description format
    const finalCategory = issue_category || issue?.split(':')[0]?.trim() || 'General Inquiry';
    const finalDesc = description || issue?.split(':').slice(1).join(':').trim() || issue || '';
    const { rows } = await db.query(
      `INSERT INTO farmer_support (farmer_id, company_id, issue_category, description, issue, status, resolution, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [farmer_id, compId, finalCategory, finalDesc, issue || finalCategory, status || 'Open', resolution || null, priority || 'Medium']
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
