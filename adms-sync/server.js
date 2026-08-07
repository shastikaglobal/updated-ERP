const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Polyfill fetch for older Node.js versions
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('./db');

const path = require('path');
const fs = require('fs');

let dir = __dirname;
let envPath;
while (dir) {
  const check = path.join(dir, '.env');
  if (fs.existsSync(check)) {
    envPath = check;
    break;
  }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
if (envPath) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

console.log("SERVER PG_PASSWORD:", process.env.PG_PASSWORD); const app = express();
app.set('trust proxy', 1);

// PAYSLIPS ROUTE
app.get('/api/payslips', async (req, res) => {
  try {
    const { employee_id, month } = req.query;
    if (!employee_id || !month) return res.status(400).json({ error: 'Missing employee_id or month' });
    
    // First, check if payslip already exists
    const { rows: existing } = await db.query('SELECT * FROM payslips WHERE employee_id = $1 AND month_year = $2', [employee_id, month]);
    if (existing.length > 0) {
      return res.json(existing[0]);
    }
    
    // If not, fetch employee master data and calculate
    const { rows: emps } = await db.query('SELECT * FROM profiles WHERE id = $1', [employee_id]);
    if (emps.length === 0) return res.status(404).json({ error: 'Employee not found' });
    
    const emp = emps[0];
    const basic = parseFloat(emp.monthly_salary) || 0;
    const basicEarnings = basic * 0.4;
    const hraEarnings = basic * 0.2;
    const pfDeduction = basicEarnings * 0.12;
    
    const gross = basicEarnings + hraEarnings;
    const net = gross - pfDeduction;
    
    const { rows: inserted } = await db.query(`
      INSERT INTO payslips (
        employee_id, month_year, emp_code, employee_name, father_husband_name, 
        department, designation, pan_no, esi_no, pf_no, bank_name, bank_account_no, uan_no,
        basic_earnings, hra_earnings, pf_deduction, gross_pay, total_deductions, net_pay
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      employee_id, month, emp.employee_id, emp.full_name, emp.father_husband_name,
      emp.department, emp.role, emp.pan_no, emp.esi_no, emp.pf_no, emp.bank_name, emp.bank_account_no, emp.uan_no,
      basicEarnings, hraEarnings, pfDeduction, gross, pfDeduction, net
    ]);
    
    return res.json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const PORT = process.env.PORT || 8082;

// Initialize Supabase Client (Removed)

const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

app.use(express.json());
app.use(cookieParser());

// Strict CORS configuration
const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:8080', 
  process.env.FRONTEND_URL 
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Limit each IP to 1000 requests per `window` (here, per minute)
  standardHeaders: true,
  legacyHeaders: false
      });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again after 15 minutes." }
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);

// Handle JSON parse errors from body-parser to avoid crashing on malformed payloads
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.warn('⚠️ Invalid JSON payload received:', err.message);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

app.use((req, res, next) => {
  if (req.url.includes('/api/emails') && req.method === 'POST') {
    require('fs').appendFileSync('requests.log', JSON.stringify({ body: req.body, time: new Date() }) + '\n');
  }
  next();
});

// --- Vehicles & Drivers Top Level APIs ---
app.get('/api/vehicles', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, vehicle_number, vehicle_type FROM vehicles WHERE is_active = true AND is_deleted IS NOT TRUE ORDER BY vehicle_number');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/vehicles error:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const { vehicle_number, vehicle_type } = req.body;
    if (!vehicle_number) return res.status(400).json({ error: 'vehicle_number is required' });
    const insertQuery = `INSERT INTO vehicles (vehicle_number, vehicle_type, is_active) VALUES ($1, $2, true) RETURNING id, vehicle_number, vehicle_type`;
    const { rows } = await db.query(insertQuery, [vehicle_number, vehicle_type || null]);
    res.json(rows[0]);
  } catch (err) {
    console.error('POST /api/vehicles error:', err?.message || err);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

app.get('/api/drivers', async (req, res) => {
  try {
    const { rows } = await db.query("SELECT id, driver_name, COALESCE(license_number, '') AS license_number FROM drivers WHERE is_active = true AND is_deleted IS NOT TRUE ORDER BY driver_name");
    res.json(rows);
  } catch (err) {
    console.error('GET /api/drivers error:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    const driver_name = req.body.driver_name || req.body.name || req.body.driverName;
    const license_number = req.body.license_number || req.body.licenseNumber || null;
    if (!driver_name) return res.status(400).json({ error: 'driver_name is required' });
    const insertQuery = `INSERT INTO drivers (driver_name, license_number, is_active) VALUES ($1, $2, true) RETURNING id, driver_name, license_number`;
    const { rows } = await db.query(insertQuery, [driver_name, license_number]);
    res.json(rows[0]);
  } catch (err) {
    console.error('POST /api/drivers error:', err?.message || err);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

// --- Mount API Routes ---
const attendanceRoutes = require('./routes/attendance');
const employeesRoutes = require('./routes/employees');
const crmApi = require('./routes/crm_api');
const inventoryApi = require('./routes/inventory_api');
const followUpsRoutes = require('./routes/follow_ups');
const crmTasksRoutes = require('./routes/crm_tasks');
const quotationsRoutes = require('./routes/quotations');
const warehouseRoutes = require('./routes/warehouse');
const analyticsRoutes = require('./routes/analytics');
const dispatchRoutes = require('./routes/dispatch');
const invoicesRoutes = require('./routes/invoices');
const mailboxRoutes = require('./routes/mailbox');
const productsRoutes = require('./routes/products');
const customersRoutes = require('./routes/customers');
const metaRoutes = require('./routes/meta');
const settingsRoutes = require('./routes/settings');
const financeRoutes = require('./routes/finance');
const ordersRoutes = require('./routes/orders');
const hrRoutes = require('./routes/hr');
const barcodesRoutes = require('./routes/barcodes');
const farmersRoutes = require('./routes/farmers');
const leavesRoutes = require('./routes/leaves');
const permissionsRoutes = require('./routes/permissions');
const securityRoutes = require('./routes/security');
const procurementRoutes = require('./routes/procurement');
const purchaseOrdersRoutes = require('./routes/purchase_orders');
const documentsRoutes = require('./routes/documents');
const sessionsRoutes = require('./routes/sessions');
const shipmentsRoutes = require('./routes/shipments');
const zohoRoutes = require('./routes/zoho');
const uploadRoutes = require('./routes/upload');
app.use('/api/follow-ups', followUpsRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/farmers', farmersRoutes);
app.use('/api/barcodes', barcodesRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leads', require('./routes/crm'));
app.use('/api/crm', require('./routes/crm_api'));
app.use('/api/inventory', require('./routes/inventory_api'));
app.use('/api/crm/tasks', require('./routes/crm_tasks'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/user-permissions', permissionsRoutes);
app.use('/api', invoicesRoutes);
app.use('/api/emails', mailboxRoutes);
app.use('/api', productsRoutes);
app.use('/api', settingsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/purchase_orders', purchaseOrdersRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/zoho', zohoRoutes);

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const { rows: existing } = await db.query('SELECT id FROM profiles WHERE email = $1 LIMIT 1', [email.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { rows } = await db.query(
      'INSERT INTO profiles (email, password_hash, full_name, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role',
      [email.trim(), passwordHash, full_name, 'admin', 'active']
    );

    const user = rows[0];
    const secret = process.env.JWT_SECRET;
    const accessToken = jwt.sign({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated'
    }, secret, { expiresIn: '1h' });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshHash, expiresAt]
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
      });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
      });

    res.json({
      session: {
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { full_name: user.full_name, force_password_reset: user.force_password_reset }
        }
      }
    });
  } catch (err) {
    console.error('VPS auth signup error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log(`[VPS Auth] Attempting login for email: ${email}`);

    // Look up in the local VPS profiles table
    const { rows } = await db.query(
      'SELECT id, full_name, email, role, status, password_hash, force_password_reset FROM profiles WHERE email = $1 AND is_deleted IS NOT TRUE LIMIT 1',
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const user = rows[0];

    // Verify password using bcrypt
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid login credentials. Please reset your password if you migrated from Supabase.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    console.log(`[VPS Auth] Valid credentials for ${user.full_name}. Issuing tokens...`);

    const secret = process.env.JWT_SECRET;
    
    // Issue Access Token (short lived, e.g. 1 hour)
    const accessToken = jwt.sign({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated'
    }, secret, { expiresIn: '1h' });

    // Issue Refresh Token (long lived, e.g. 30 days)
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    // Store refresh token in DB
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshHash, expiresAt]
    );

    // Set HttpOnly Cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });

    res.json({
      session: {
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { full_name: user.full_name }
        }
      }
    });
  } catch (err) {
    console.error('VPS auth login error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/me', require('./middleware/auth').requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, full_name, email, role, status, force_password_reset FROM profiles WHERE id = $1 LIMIT 1',
      [req.user.sub]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch(err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/roles', require('./middleware/auth').requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.slug, p.code 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1
    `, [req.user.sub]);

    res.json({ roles: rows });
  } catch(err) {
    console.error('Fetch roles error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    try {
      await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [refreshHash]);
    } catch(err) {
      console.error('Logout cleanup error:', err);
    }
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { rows } = await db.query(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1',
      [refreshHash]
    );

    if (rows.length === 0) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (new Date() > rows[0].expires_at) {
      await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [refreshHash]);
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const userId = rows[0].user_id;
    const { rows: userRows } = await db.query(
      'SELECT email FROM profiles WHERE id = $1 AND is_active = true AND is_deleted IS NOT TRUE',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ error: 'User inactive or deleted' });
    }

    const secret = process.env.JWT_SECRET;
    const accessToken = jwt.sign({
      sub: userId,
      email: userRows[0].email,
      role: 'authenticated',
      aud: 'authenticated'
    }, secret, { expiresIn: '1h' });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
      });

    res.json({ success: true });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/face-scan', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const { embedding, livenessResult } = req.body;

  if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
    return res.status(400).json({ error: 'Invalid face embedding. Expected 128-dim array.' });
  }

  // 1. Liveness check FIRST
  if (!livenessResult?.allPassed) {
    try {
      await db.query(`
        INSERT INTO face_scan_events (
          match_score, liveness_score, motion_pass, blink_pass, depth_pass, spoof_pass, 
          status, error_reason, ip_address, scanned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        0, 
        livenessResult?.livenessScore || 0,
        livenessResult?.checks?.motion?.pass || false,
        livenessResult?.checks?.blink?.pass || false,
        livenessResult?.checks?.depth?.pass || false,
        false,
        'spoof_detected',
        'Liveness check failed',
        ip
      ]);
    } catch (err) {
      console.error('[Face Scan] Event log failed:', err.message);
    }

    return res.status(200).json({
      matched: false,
      error: 'Liveness check failed. Please look at the camera naturally and blink.',
      code: 'LIVENESS_FAIL'
    });
  }

  try {
    // 2. Fetch all face embeddings from local database
    const { rows: storedEmbeddings } = await db.query(`
      SELECT f.employee_id, f.face_embedding, p.full_name as name, p.department, p.biometric_id, p.punch_deadline
      FROM face_embeddings f
      LEFT JOIN profiles p ON f.employee_id::text = p.id::text
      WHERE p.is_deleted IS NOT TRUE
    `);

    // 3. Find the best match locally using Euclidean distance
    let bestDistance = Infinity;
    let bestMatch = null;

    for (const row of storedEmbeddings) {
      let stored = row.face_embedding;
      if (typeof stored === 'string') {
        try {
          stored = JSON.parse(stored);
        } catch (e) {
          stored = stored.replace(/[\[\]]/g, '').split(',').map(Number);
        }
      }
      
      if (!Array.isArray(stored) || stored.length !== 128) continue;

      // Calculate Euclidean distance
      let sum = 0;
      for (let i = 0; i < 128; i++) {
        const diff = embedding[i] - stored[i];
        sum += diff * diff;
      }
      const distance = Math.sqrt(sum);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = row;
      }
    }

    const MATCH_DISTANCE_THRESHOLD = 0.50; // standard same-person Euclidean threshold
    const confidenceScore = Math.round((1 - Math.min(Math.max(bestDistance, 0), 1)) * 100);
    const matched = bestDistance <= MATCH_DISTANCE_THRESHOLD;

    if (!matched || !bestMatch) {
      // Log failed match scan event
      try {
        await db.query(`
          INSERT INTO face_scan_events (
            match_score, liveness_score, motion_pass, blink_pass, depth_pass, spoof_pass, 
            status, error_reason, ip_address, scanned_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          0,
          livenessResult.livenessScore || 0,
          livenessResult.checks.motion.pass,
          livenessResult.checks.blink.pass,
          livenessResult.checks.depth.pass,
          true,
          'failed',
          'No matching employee found',
          ip
        ]);
      } catch (logErr) {
        console.error('[Face Scan] Failed log attempt:', logErr.message);
      }

      return res.status(200).json({
        matched: false,
        error: 'Face not recognized. Please contact your admin.',
        code: 'NO_MATCH'
      });
    }

    // 4. Match found! Mark attendance locally
    const employeeId = bestMatch.employee_id;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIso = new Date().toISOString();
    const nowTimeStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }); // "HH:MM:SS"

    // Check if check-in exists for today
    const { rows: existingLogs } = await db.query(
      'SELECT * FROM attendance_logs WHERE employee_id = $1 AND date = $2 LIMIT 1',
      [employeeId, todayStr]
    );

    let action = 'punch_in';
    let is_late = false;
    let late_by_mins = 0;
    let salary_cut = 0;

    if (existingLogs.length === 0) {
      // Determine if check-in is late
      const deadline = bestMatch.punch_deadline || '09:15:00';
      if (nowTimeStr > deadline) {
        is_late = true;
        // Calculate late minutes
        const [nowH, nowM] = nowTimeStr.split(':').map(Number);
        const [deadH, deadM] = deadline.split(':').map(Number);
        late_by_mins = Math.max(0, (nowH * 60 + nowM) - (deadH * 60 + deadM));
        
        if (late_by_mins > 30) {
          salary_cut = 100;
        }
      }

      const status = is_late ? 'late' : 'present';

      // Insert check-in log
      await db.query(
        `INSERT INTO attendance_logs (employee_id, date, status, clock_in) 
         VALUES ($1, $2, $3, $4)`,
        [employeeId, todayStr, status, nowIso]
      );

      // Insert to face_attendance
      await db.query(
        `INSERT INTO face_attendance (employee_id, date, clock_in, status) 
         VALUES ($1, $2, $3, $4)`,
        [employeeId, todayStr, nowIso, status]
      );

      action = 'punch_in';
    } else {
      const log = existingLogs[0];
      if (!log.clock_out) {
        // Punch Out
        await db.query(
          'UPDATE attendance_logs SET clock_out = $1 WHERE id = $2',
          [nowIso, log.id]
        );

        // Update face_attendance clock_out
        await db.query(
          'UPDATE face_attendance SET clock_out = $1 WHERE employee_id = $2 AND date = $3',
          [nowIso, employeeId, todayStr]
        );

        action = 'punch_out';
      } else {
        action = 'punch_out';
      }
    }

    // 5. Log successful scan event
    try {
      await db.query(`
        INSERT INTO face_scan_events (
          employee_id, match_score, liveness_score, motion_pass, blink_pass, depth_pass, 
          spoof_pass, status, ip_address, scanned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        employeeId,
        confidenceScore,
        livenessResult.livenessScore,
        livenessResult.checks.motion.pass,
        livenessResult.checks.blink.pass,
        livenessResult.checks.depth.pass,
        true,
        'matched',
        ip
      ]);
    } catch (logErr) {
      console.error('[Face Scan] Event log failed:', logErr.message);
    }

    return res.status(200).json({
      matched: true,
      employee: {
        id: employeeId,
        name: bestMatch.name,
        bio_id: bestMatch.biometric_id,
        department: bestMatch.department
      },
      attendance: {
        action,
        is_late,
        late_by_mins,
        salary_cut,
        confidence: confidenceScore,
        timestamp: nowIso
      }
    });

  } catch (err) {
    console.error('[face-scan API] Local error:', err.message);
    return res.status(500).json({ error: 'Server error during local face scan', detail: err.message });
  }
});




// Ensure audit_logs table exists
db.query(`
  CREATE TABLE IF NOT EXISTS password_reset_audit (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    email VARCHAR(255),
    action VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // 1. Fetch user from local profiles
    const { rows } = await db.query(
      'SELECT id, full_name, email FROM profiles WHERE email = $1 AND is_deleted IS NOT TRUE LIMIT 1',
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.json({ success: true, message: 'Your password reset request has been sent to the system administrator. Please wait for the administrator to provide your temporary password.' });
    }
    const user = rows[0];

    // 2. Generate secure token (15-30 min expiration)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.query(
      'INSERT INTO password_resets (user_id, reset_token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    // Audit log
    await db.query('INSERT INTO password_reset_audit (user_id, email, action) VALUES ($1, $2, $3)', [user.id, user.email, 'REQUESTED']);

    // 3. Send email to User directly via Resend
    const isResend = !!process.env.RESEND_API_KEY;
    const transporter = nodemailer.createTransport({
      host: isResend ? 'smtp.resend.com' : (process.env.SMTP_HOST || 'smtp.zoho.in'),
      port: isResend ? 465 : (process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: isResend ? 'resend' : (process.env.SMTP_USER || 'erp@shastikaglobal.com'),
        pass: isResend ? process.env.RESEND_API_KEY : (process.env.SMTP_PASS || 'default_password_here')
      }
    });

    const actionLink = `${req.headers.origin || 'http://localhost:8080'}/auth?mode=reset&token=${resetToken}`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>🔑 Password Reset Request</h2>
        <p>Hi ${user.full_name},</p>
        <p>You recently requested to reset your password for your AgriExport ERP account. Click the button below to proceed:</p>
        <a href="${actionLink}" style="background-color: #f5c518; color: black; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px; font-weight: bold;">Reset Password</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">This secure link expires in 30 minutes and can only be used once.</p>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">If you did not request a password reset, please ignore this email.</p>
      </div>
    `;

    try {
      const fromEmail = isResend ? 'onboarding@resend.dev' : (process.env.SMTP_USER || 'erp@shastikaglobal.com');
      const toEmail = user.email;
      
      console.log('--- PASSWORD RESET EMAIL DEBUG ---');
      console.log('Sending email VIA:', isResend ? 'RESEND' : 'SMTP');
      console.log('FROM address:', fromEmail);
      console.log('TO address:', toEmail);
      console.log('API Key / Pass length:', isResend ? process.env.RESEND_API_KEY?.length : process.env.SMTP_PASS?.length);
      console.log('----------------------------------');

      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: `Password Reset - AgriExport ERP`,
        html: htmlContent
      });
      
      console.log('--- EMAIL SEND SUCCESS ---');
      console.log('Response:', info);
      console.log('--------------------------');
      
      return res.json({ success: true, message: `Password reset link sent to ${user.email}.` });
    } catch (mailErr) {
      console.error('--- EMAIL SEND FAILED ---');
      console.error('SMTP/Resend Error details:', mailErr);
      console.error('-------------------------');
      return res.json({ success: true, message: 'Your password reset request has been sent to the system administrator. Please wait for the administrator to provide your temporary password.', link: actionLink });
    }
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/update-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await db.query(
      'SELECT user_id, expires_at FROM password_resets WHERE reset_token_hash = $1',
      [tokenHash]
    );

    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });
    
    if (new Date() > rows[0].expires_at) {
      await db.query('DELETE FROM password_resets WHERE reset_token_hash = $1', [tokenHash]);
      return res.status(400).json({ error: 'Token expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user profile - Force them to reset on next login!
    await db.query('UPDATE profiles SET password_hash = $1, force_password_reset = true, updated_at = NOW() WHERE id = $2', [passwordHash, rows[0].user_id]);
    
    // Audit log
    await db.query('INSERT INTO password_reset_audit (user_id, action) VALUES ($1, $2)', [rows[0].user_id, 'COMPLETED']);

    // Cleanup token (One-time use)
    await db.query('DELETE FROM password_resets WHERE reset_token_hash = $1', [tokenHash]);

    res.json({ success: true, message: 'Temporary password created successfully. The employee must change it on their next login.' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/me', require('./middleware/auth').requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, full_name, email, role, status, force_password_reset FROM profiles WHERE id = $1 LIMIT 1',
      [req.user.sub]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch(err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/roles', require('./middleware/auth').requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.slug, p.code 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1
    `, [req.user.sub]);

    res.json({ roles: rows });
  } catch(err) {
    console.error('Fetch roles error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    try {
      await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [refreshHash]);
    } catch(err) {
      console.error('Logout cleanup error:', err);
    }
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { rows } = await db.query(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1',
      [refreshHash]
    );

    if (rows.length === 0) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (new Date() > rows[0].expires_at) {
      await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [refreshHash]);
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const userId = rows[0].user_id;
    const { rows: userRows } = await db.query(
      'SELECT email FROM profiles WHERE id = $1 AND is_active = true AND is_deleted IS NOT TRUE',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ error: 'User inactive or deleted' });
    }

    const secret = process.env.JWT_SECRET;
    const accessToken = jwt.sign({
      sub: userId,
      email: userRows[0].email,
      role: 'authenticated',
      aud: 'authenticated'
    }, secret, { expiresIn: '1h' });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
      });

    res.json({ success: true });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/face-scan', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const { embedding, livenessResult } = req.body;

  if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
    return res.status(400).json({ error: 'Invalid face embedding. Expected 128-dim array.' });
  }

  // 1. Liveness check FIRST
  if (!livenessResult?.allPassed) {
    try {
      await db.query(`
        INSERT INTO face_scan_events (
          match_score, liveness_score, motion_pass, blink_pass, depth_pass, spoof_pass, 
          status, error_reason, ip_address, scanned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        0, 
        livenessResult?.livenessScore || 0,
        livenessResult?.checks?.motion?.pass || false,
        livenessResult?.checks?.blink?.pass || false,
        livenessResult?.checks?.depth?.pass || false,
        false,
        'spoof_detected',
        'Liveness check failed',
        ip
      ]);
    } catch (err) {
      console.error('[Face Scan] Event log failed:', err.message);
    }

    return res.status(200).json({
      matched: false,
      error: 'Liveness check failed. Please look at the camera naturally and blink.',
      code: 'LIVENESS_FAIL'
    });
  }

  try {
    // 2. Fetch all face embeddings from local database
    const { rows: storedEmbeddings } = await db.query(`
      SELECT f.employee_id, f.face_embedding, p.full_name as name, p.department, p.biometric_id, p.punch_deadline
      FROM face_embeddings f
      LEFT JOIN profiles p ON f.employee_id::text = p.id::text
      WHERE p.is_deleted IS NOT TRUE
    `);

    // 3. Find the best match locally using Euclidean distance
    let bestDistance = Infinity;
    let bestMatch = null;

    for (const row of storedEmbeddings) {
      let stored = row.face_embedding;
      if (typeof stored === 'string') {
        try {
          stored = JSON.parse(stored);
        } catch (e) {
          stored = stored.replace(/[\[\]]/g, '').split(',').map(Number);
        }
      }
      
      if (!Array.isArray(stored) || stored.length !== 128) continue;

      // Calculate Euclidean distance
      let sum = 0;
      for (let i = 0; i < 128; i++) {
        const diff = embedding[i] - stored[i];
        sum += diff * diff;
      }
      const distance = Math.sqrt(sum);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = row;
      }
    }

    const MATCH_DISTANCE_THRESHOLD = 0.50; // standard same-person Euclidean threshold
    const confidenceScore = Math.round((1 - Math.min(Math.max(bestDistance, 0), 1)) * 100);
    const matched = bestDistance <= MATCH_DISTANCE_THRESHOLD;

    if (!matched || !bestMatch) {
      // Log failed match scan event
      try {
        await db.query(`
          INSERT INTO face_scan_events (
            match_score, liveness_score, motion_pass, blink_pass, depth_pass, spoof_pass, 
            status, error_reason, ip_address, scanned_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          0,
          livenessResult.livenessScore || 0,
          livenessResult.checks.motion.pass,
          livenessResult.checks.blink.pass,
          livenessResult.checks.depth.pass,
          true,
          'failed',
          'No matching employee found',
          ip
        ]);
      } catch (logErr) {
        console.error('[Face Scan] Failed log attempt:', logErr.message);
      }

      return res.status(200).json({
        matched: false,
        error: 'Face not recognized. Please contact your admin.',
        code: 'NO_MATCH'
      });
    }

    // 4. Match found! Mark attendance locally
    const employeeId = bestMatch.employee_id;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIso = new Date().toISOString();
    const nowTimeStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }); // "HH:MM:SS"

    // Check if check-in exists for today
    const { rows: existingLogs } = await db.query(
      'SELECT * FROM attendance_logs WHERE employee_id = $1 AND date = $2 LIMIT 1',
      [employeeId, todayStr]
    );

    let action = 'punch_in';
    let is_late = false;
    let late_by_mins = 0;
    let salary_cut = 0;

    if (existingLogs.length === 0) {
      // Determine if check-in is late
      const deadline = bestMatch.punch_deadline || '09:15:00';
      if (nowTimeStr > deadline) {
        is_late = true;
        // Calculate late minutes
        const [nowH, nowM] = nowTimeStr.split(':').map(Number);
        const [deadH, deadM] = deadline.split(':').map(Number);
        late_by_mins = Math.max(0, (nowH * 60 + nowM) - (deadH * 60 + deadM));
        
        if (late_by_mins > 30) {
          salary_cut = 100;
        }
      }

      const status = is_late ? 'late' : 'present';

      // Insert check-in log
      await db.query(
        `INSERT INTO attendance_logs (employee_id, date, status, clock_in) 
         VALUES ($1, $2, $3, $4)`,
        [employeeId, todayStr, status, nowIso]
      );

      // Insert to face_attendance
      await db.query(
        `INSERT INTO face_attendance (employee_id, date, clock_in, status) 
         VALUES ($1, $2, $3, $4)`,
        [employeeId, todayStr, nowIso, status]
      );

      action = 'punch_in';
    } else {
      const log = existingLogs[0];
      if (!log.clock_out) {
        // Punch Out
        await db.query(
          'UPDATE attendance_logs SET clock_out = $1 WHERE id = $2',
          [nowIso, log.id]
        );

        // Update face_attendance clock_out
        await db.query(
          'UPDATE face_attendance SET clock_out = $1 WHERE employee_id = $2 AND date = $3',
          [nowIso, employeeId, todayStr]
        );

        action = 'punch_out';
      } else {
        action = 'punch_out';
      }
    }

    // 5. Log successful scan event
    try {
      await db.query(`
        INSERT INTO face_scan_events (
          employee_id, match_score, liveness_score, motion_pass, blink_pass, depth_pass, 
          spoof_pass, status, ip_address, scanned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        employeeId,
        confidenceScore,
        livenessResult.livenessScore,
        livenessResult.checks.motion.pass,
        livenessResult.checks.blink.pass,
        livenessResult.checks.depth.pass,
        true,
        'matched',
        ip
      ]);
    } catch (logErr) {
      console.error('[Face Scan] Event log failed:', logErr.message);
    }

    return res.status(200).json({
      matched: true,
      employee: {
        id: employeeId,
        name: bestMatch.name,
        bio_id: bestMatch.biometric_id,
        department: bestMatch.department
      },
      attendance: {
        action,
        is_late,
        late_by_mins,
        salary_cut,
        confidence: confidenceScore,
        timestamp: nowIso
      }
    });

  } catch (err) {
    console.error('[face-scan API] Local error:', err.message);
    return res.status(500).json({ error: 'Server error during local face scan', detail: err.message });
  }
});

const nodemailer = require('nodemailer');

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // 1. Fetch user from local profiles
    const { rows } = await db.query(
      'SELECT id, full_name, email FROM profiles WHERE email = $1 AND is_deleted IS NOT TRUE LIMIT 1',
      [email.trim()]
    );

    if (rows.length === 0) {
      // Don't leak whether the email exists, just say sent
      return res.json({ success: true, message: 'If an account exists, a reset link was sent.' });
    }
    const user = rows[0];

    // 2. Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'INSERT INTO password_resets (user_id, reset_token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    // 3. Send email using Nodemailer (Zoho SMTP or fallback)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zoho.in',
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'erp@shastikaglobal.com',
        pass: process.env.SMTP_PASS || 'default_password_here'
      }
    });

    const actionLink = `${req.headers.origin || 'http://localhost:8080'}/auth?mode=reset&token=${resetToken}`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>🔑 Password Reset Request</h2>
        <p>Hello ${user.full_name || 'User'},</p>
        <p>You requested to reset your password. Click the link below:</p>
        <a href="${actionLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a>
        <p>If you did not request this, ignore this email.</p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER || 'erp@shastikaglobal.com',
        to: user.email, // Or 'shastikaglobal11@gmail.com' if admin needs to receive it
        subject: 'Password Reset',
        html: htmlContent
      });
      return res.json({ success: true, message: 'Password reset link sent successfully.' });
    } catch (mailErr) {
      console.error('SMTP Error:', mailErr);
      console.log('Returning link directly since SMTP failed:', actionLink);
      return res.json({ success: true, message: 'Your password reset request has been sent to the system administrator. Please wait for the administrator to provide your temporary password.', link: actionLink });
    }
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/update-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await db.query(
      'SELECT user_id, expires_at FROM password_resets WHERE reset_token_hash = $1',
      [tokenHash]
    );

    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });
    
    if (new Date() > rows[0].expires_at) {
      await db.query('DELETE FROM password_resets WHERE reset_token_hash = $1', [tokenHash]);
      return res.status(400).json({ error: 'Token expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user profile
    await db.query('UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, rows[0].user_id]);
    
    // Cleanup token
    await db.query('DELETE FROM password_resets WHERE reset_token_hash = $1', [tokenHash]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update password for logged-in users
app.put('/api/auth/update-password', require('./middleware/auth').requireAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const userId = req.user.sub;
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user profile
    await db.query('UPDATE profiles SET password_hash = $1, force_password_reset = false, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error (PUT):', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Temporary top-level debug endpoint to fetch converted leads without router/auth issues
app.get('/api/leads/converted/debug2', async (req, res) => {
  try {
    const companyId = req.query.company_id;
    if (!companyId) return res.status(400).json({ error: 'company_id required' });
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(companyId)) return res.status(400).json({ error: 'Invalid company_id format' });

    console.log(`[DEBUG] /api/leads/converted/debug2 - company_id=${companyId}`);

    const q = `
      SELECT
        l.id,
        COALESCE(l.company_name, NULLIF(TRIM(l.contact_name), ''), 'Unknown') AS client_name,
        COALESCE(l.country, 'Unknown') AS country,
        COALESCE(ac.channel_name, 'Direct / Unknown') AS source,
        COALESCE(l.assigned_to, 'Unassigned') AS assigned_bde,
        COALESCE(l.converted_at, l.created_at) AS acquisition_date,
        COALESCE(l.interested_product, l.product_type, 'N/A') AS product_interested,
        0 AS deal_value,
        l.stage AS status
      FROM leads l
      LEFT JOIN acquisition_channels ac ON ac.id = l.source_id
      WHERE l.company_id = $1
        AND l.is_deleted IS NOT TRUE
        AND (
          l.stage ILIKE '%client%'
          OR l.stage ILIKE '%convert%'
          OR l.stage ILIKE '%won%'
        )
      ORDER BY l.created_at DESC
    `;

    const { rows } = await db.query(q, [companyId]);
    res.json(rows);
  } catch (err) {
    console.error('DB Error (debug2 converted leads):', err);
    if (err && err.stack) console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

console.log("🚀 Starting ADMS Sync Server...");


/**
 * 1. GET /iclock/cdata - Handshake & Device Initialization
 * Device queries server configurations and registers itself.
 */
app.get(['/iclock/cdata', '/iclock/cdata.aspx'], (req, res) => {
  const sn = req.query.SN || 'UNKNOWN';
  console.log(`\n📡 [GET /iclock/cdata] Handshake received from device SN: ${sn}`);
  console.log("Params:", req.query);

  // Configuration options to send back to the device to control sync behavior
  const responseConfig = [
    `GET OPTION FROM: ${sn}`,
    `Stamp=${Date.now()}`,
    `OpStamp=${process.env.ADMS_OP_STAMP || '1'}`,
    `ErrorDelay=${process.env.ADMS_ERROR_DELAY || '60'}`,
    `Delay=${process.env.ADMS_DELAY || '30'}`,
    `TransTimes=${process.env.ADMS_TRANS_TIMES || '00:00;23:59'}`,
    `TransInterval=${process.env.ADMS_TRANS_INTERVAL || '1'}`,
    `TransFlag=${process.env.ADMS_TRANS_FLAG || '1111111111'}`,
    `Realtime=${process.env.ADMS_REALTIME || '1'}`,
    `Encrypt=${process.env.ADMS_ENCRYPT || '0'}`
  ].join('\r\n') + '\r\n';

  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(responseConfig);
});

/**
 * 2. POST /iclock/cdata - Receive Punch Logs (ATTLOG) & Operation Logs (OPERLOG)
 * The device pushes new attendance records here.
 */
app.post(['/iclock/cdata', '/iclock/cdata.aspx'], express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
  const sn = req.query.SN || 'UNKNOWN';
  const table = req.query.table || 'UNKNOWN';
  console.log(`\n📥 [POST /iclock/cdata] Data upload from SN: ${sn}, Table: ${table}`);

  const rawData = req.body;
  if (!rawData || rawData.trim() === '') {
    console.log("⚠️ Received empty payload.");
    return res.status(200).send('OK');
  }

  // Handle Attendance Logs
  if (table.toUpperCase() === 'ATTLOG') {
    try {
      const lines = rawData.split(/\r?\n/);
      console.log(`📦 Parsing ${lines.length} lines of attendance logs...`);

      // Fetch active profiles from local DB to map biometric IDs to employee IDs
      let profiles = [];
      try {
        const { rows } = await db.query('SELECT id, company_id, biometric_id FROM profiles WHERE is_deleted IS NOT TRUE');
        profiles = rows;
      } catch (profErr) {
        console.error("❌ Failed to load profiles from DB:", profErr.message);
        // Respond OK anyway so device doesn't get stuck, but log the error
        return res.status(200).send('OK');
      }

      let processedCount = 0;

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // ATTLOG format: User-PIN \t Timestamp \t Status \t VerifyMode \t WorkCode ...
        const parts = line.split('\t');
        const biometricId = parts[0]?.trim();
        const punchTimeStr = parts[1]?.trim(); // Format: YYYY-MM-DD HH:mm:ss

        if (!biometricId || !punchTimeStr) {
          console.warn(`⚠️ Skipped invalid line format: "${line}"`);
          continue;
        }

        // Match profile by biometric_id
        const emp = profiles.find(p => 
          p.biometric_id === biometricId || 
          (p.biometric_id && Number(p.biometric_id) === Number(biometricId))
        );

        if (!emp) {
          console.warn(`⚠️ Skipped punch: Biometric ID [${biometricId}] is not mapped to any profile in the profiles table.`);
          continue;
        }

        // Parse punch timestamp
        const dateParts = punchTimeStr.split(' ');
        const dateStr = dateParts[0]; // "YYYY-MM-DD"
        
        // Assume device is running in India Standard Time (+05:30)
        const tzOffset = process.env.DEVICE_TIMEZONE_OFFSET || '+05:30';
        const punchTimeUTC = new Date(punchTimeStr.replace(' ', 'T') + tzOffset);

        if (isNaN(punchTimeUTC.getTime())) {
          console.error(`❌ Invalid timestamp parsed: "${punchTimeStr}"`);
          continue;
        }

        const punchTimeIso = punchTimeUTC.toISOString();

        // Check if attendance record already exists for this day
        let existing = null;
        try {
          const { rows } = await db.query(
            'SELECT * FROM attendance_logs WHERE employee_id = $1 AND date = $2 LIMIT 1',
            [emp.id, dateStr]
          );
          if (rows.length > 0) existing = rows[0];
        } catch (existErr) {
          console.error(`❌ DB error checking attendance for employee [${emp.id}] on [${dateStr}]:`, existErr.message);
          continue;
        }

        if (!existing) {
          // Create new record with clock_in = punchTime
          try {
            await db.query(
              'INSERT INTO attendance_logs (employee_id, date, status, clock_in, clock_out) VALUES ($1, $2, $3, $4, $5)',
              [emp.id, dateStr, 'present', punchTimeIso, null]
            );
            console.log(`✅ Logged Check-In for employee [${emp.id}] on ${dateStr} at ${punchTimeIso}`);
            processedCount++;
          } catch (insertErr) {
            console.error(`❌ Failed to insert attendance:`, insertErr.message);
          }
        } else {
          // Record exists. Update clock_in or clock_out.
          let updatedClockIn = existing.clock_in;
          let updatedClockOut = existing.clock_out;

          const currentPunchTimeMs = punchTimeUTC.getTime();
          const punchStatus = parts[2]?.trim();

          if (punchStatus === '0') {
            // Explicit Check-In from device
            if (!updatedClockIn) {
              updatedClockIn = punchTimeIso;
            } else if (currentPunchTimeMs < new Date(updatedClockIn).getTime()) {
              updatedClockIn = punchTimeIso; // Keep the earliest check-in
            }
          } else if (punchStatus === '1') {
            // Explicit Check-Out from device
            if (!updatedClockOut) {
              updatedClockOut = punchTimeIso;
            } else if (currentPunchTimeMs > new Date(updatedClockOut).getTime()) {
              updatedClockOut = punchTimeIso; // Keep the latest check-out
            }
          } else {
            // Fallback to time-based guessing if device doesn't send 0/1 properly
            if (!updatedClockIn) {
              updatedClockIn = punchTimeIso;
            } else {
              const existingInMs = new Date(updatedClockIn).getTime();
              if (currentPunchTimeMs < existingInMs) {
                updatedClockIn = punchTimeIso; // Earlier punch is check_in
              }
            }
            
            const existingInMsAfter = new Date(updatedClockIn).getTime();
            if (currentPunchTimeMs > existingInMsAfter) {
              if (!updatedClockOut) {
                if (currentPunchTimeMs - existingInMsAfter >= 60 * 1000) { // 1 min buffer
                  updatedClockOut = punchTimeIso;
                }
              } else {
                const existingOutMs = new Date(updatedClockOut).getTime();
                if (currentPunchTimeMs > existingOutMs) {
                  updatedClockOut = punchTimeIso; // Later punch is check_out
                }
              }
            }
          }

          try {
            updatedClockIn = updatedClockIn ? new Date(updatedClockIn).toISOString() : null;
            updatedClockOut = updatedClockOut ? new Date(updatedClockOut).toISOString() : null;
            await db.query(
              'UPDATE attendance_logs SET clock_in = $1, clock_out = $2, status = $3 WHERE id = $4',
              [updatedClockIn, updatedClockOut, 'present', existing.id]
            );
            console.log(`🔄 Updated attendance for employee [${emp.id}] on ${dateStr}: In=${updatedClockIn?.substring(11,19)}, Out=${updatedClockOut?.substring(11,19)}`);
            processedCount++;
          } catch (updateErr) {
            console.error(`❌ Failed to update attendance [${existing.id}]:`, updateErr.message);
          }
        }
        
        // --- IMMUTABLE RAW PUNCH STORAGE ---
        // Insert the raw punch log into the 'AttLogs' table so no one can erase the raw data
        try {
          const direction = parts[2]?.trim() === '0' ? 'in' : (parts[2]?.trim() === '1' ? 'out' : parts[2]?.trim());
          await db.query(
            'INSERT INTO "AttLogs" ("EmployeeCode", "LogDateTime", "DownloadDateTime", "Direction", "DeviceId") VALUES ($1, $2, $3, $4, $5)',
            [biometricId, punchTimeStr, new Date().toISOString(), direction, sn]
          );
          console.log(`🔒 Safely stored immutable raw punch in AttLogs for [${biometricId}] at ${punchTimeStr}`);
        } catch (rawLogErr) {
          console.error(`❌ Failed to store raw punch in AttLogs for [${biometricId}]:`, rawLogErr.message);
        }
        
      }

      console.log(`🎉 Sync completed. Successfully processed ${processedCount} punch(es).`);
    } catch (err) {
      console.error("❌ Exception during ATTLOG parsing:", err);
    }
  }

  // Respond with OK to acknowledge receipt
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('OK');
});

/**
 * 3. GET /iclock/getrequest - Pending commands query
 * Device asks server if there are any commands to execute.
 */
app.get(['/iclock/getrequest', '/iclock/getrequest.aspx'], (req, res) => {
  const sn = req.query.SN || 'UNKNOWN';
  console.log(`\n⏳ [GET /iclock/getrequest] Command request from SN: ${sn}`);
  
  // Return OK indicating no pending commands
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('OK');
});

/**
 * 4. POST /iclock/devicecmd - Command Execution Result
 * Device posts the execution result of commands.
 */
app.post(['/iclock/devicecmd', '/iclock/devicecmd.aspx'], (req, res) => {
  const sn = req.query.SN || 'UNKNOWN';
  console.log(`\n📥 [POST /iclock/devicecmd] Command execution report from SN: ${sn}`);
  console.log("Payload:", req.body);

  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('OK');
});

app.options('/force-logout', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

/**
 * 5. POST /force-logout - Admin Force Logout
 * Called from frontend to securely punch out a user (bypasses RLS)
 */
app.post('/force-logout', express.json(), async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  const { userId, sessionId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  
  const nowIso = new Date().toISOString();
  let updatedSession = false;
  let updatedAttendance = false;

  // 1. Update user_sessions
  if (sessionId) {
    try {
      await db.query('UPDATE user_sessions SET logout_time = $1 WHERE id = $2', [nowIso, sessionId]);
      updatedSession = true;
    } catch(e) {}
  } else {
    // find open session
    try {
      await db.query('UPDATE user_sessions SET logout_time = $1 WHERE user_id = $2 AND logout_time IS NULL', [nowIso, userId]);
      updatedSession = true;
    } catch(e) {}
  }

  // 2. Update attendance_logs
  const today = nowIso.split('T')[0];
  try {
    const { rowCount } = await db.query(
      'UPDATE attendance_logs SET check_out = $1 WHERE employee_id = $2 AND date = $3 AND check_out IS NULL',
      [nowIso, userId, today]
    );
    if (rowCount > 0) updatedAttendance = true;
  } catch (attErr) {
    console.error("Attendance update error:", attErr);
  }

  // 3. Log them out (No Supabase, so just true)
  let loggedOutApp = true;


  res.json({ success: true, updatedSession, updatedAttendance, loggedOutApp });
});

// --- Generic VPS Database Fallback Query API ---
const ALLOWED_FALLBACK_TABLES = new Set([
  'profiles', 'companies', 'user_sessions', 'activity_logs', 'attendance_logs',
  'user_roles', 'roles', 'permissions', 'role_permissions', 'active_sessions',
  'quotations', 'leads', 'tasks', 'follow_ups', 'customers', 'products',
  'inventory', 'warehouse', 'dispatch', 'invoices', 'emails', 'farmers',
  'procurement', 'purchase_orders', 'documents', 'export_certificates', 'export_containers', 'export_shipments'
]);

app.post('/api/vps-fallback', require('./middleware/auth').requireAuth, async (req, res) => {
  try {
    const { table, action, select, filters, data, order, limit, single, maybeSingle } = req.body;
    
    if (!table || !ALLOWED_FALLBACK_TABLES.has(table)) {
      return res.status(400).json({ error: `Table '${table}' is not allowed or invalid.` });
    }

    const queryParams = [];
    let sql = '';

    // Helper to add parameter and return its $placeholder
    function addParam(val) {
      queryParams.push(val);
      return `$${queryParams.length}`;
    }

    // Build WHERE clause
    let whereClause = '';
    if (filters && Array.isArray(filters) && filters.length > 0) {
      const parts = [];
      for (const filter of filters) {
        const col = filter.column;
        if (filter.type !== 'or' && !/^[a-zA-Z0-9_]+$/.test(col)) {
          return res.status(400).json({ error: `Invalid column name in filter: ${col}` });
        }

        if (filter.type === 'eq') {
          parts.push(`"${col}" = ${addParam(filter.value)}`);
        } else if (filter.type === 'neq') {
          parts.push(`"${col}" != ${addParam(filter.value)}`);
        } else if (filter.type === 'gt') {
          parts.push(`"${col}" > ${addParam(filter.value)}`);
        } else if (filter.type === 'gte') {
          parts.push(`"${col}" >= ${addParam(filter.value)}`);
        } else if (filter.type === 'lt') {
          parts.push(`"${col}" < ${addParam(filter.value)}`);
        } else if (filter.type === 'lte') {
          parts.push(`"${col}" <= ${addParam(filter.value)}`);
        } else if (filter.type === 'like') {
          parts.push(`"${col}" LIKE ${addParam(filter.value)}`);
        } else if (filter.type === 'ilike') {
          parts.push(`"${col}" ILIKE ${addParam(filter.value)}`);
        } else if (filter.type === 'is') {
          if (filter.value === null) {
            parts.push(`"${col}" IS NULL`);
          } else {
            parts.push(`"${col}" IS ${addParam(filter.value)}`);
          }
        } else if (filter.type === 'in') {
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            const placeholders = filter.value.map(v => addParam(v)).join(', ');
            parts.push(`"${col}" IN (${placeholders})`);
          } else {
            parts.push('FALSE');
          }
        } else if (filter.type === 'or') {
          const conds = filter.value.split(',');
          const orParts = [];
          for (const cond of conds) {
            const match = cond.match(/^([a-zA-Z0-9_]+)\.(eq|neq|gt|gte|lt|lte|like|ilike|is)\.(.+)$/);
            if (match) {
              const [_, orCol, orOp, orVal] = match;
              if (/^[a-zA-Z0-9_]+$/.test(orCol)) {
                let cleanVal = orVal;
                if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
                  cleanVal = cleanVal.slice(1, -1);
                } else if (cleanVal.startsWith("'") && cleanVal.endsWith("'")) {
                  cleanVal = cleanVal.slice(1, -1);
                }
                
                if (orOp === 'eq') {
                  orParts.push(`"${orCol}" = ${addParam(cleanVal)}`);
                } else if (orOp === 'neq') {
                  orParts.push(`"${orCol}" != ${addParam(cleanVal)}`);
                } else if (orOp === 'gt') {
                  orParts.push(`"${orCol}" > ${addParam(cleanVal)}`);
                } else if (orOp === 'gte') {
                  orParts.push(`"${orCol}" >= ${addParam(cleanVal)}`);
                } else if (orOp === 'lt') {
                  orParts.push(`"${orCol}" < ${addParam(cleanVal)}`);
                } else if (orOp === 'lte') {
                  orParts.push(`"${orCol}" <= ${addParam(cleanVal)}`);
                } else if (orOp === 'like') {
                  orParts.push(`"${orCol}" LIKE ${addParam(cleanVal)}`);
                } else if (orOp === 'ilike') {
                  orParts.push(`"${orCol}" ILIKE ${addParam(cleanVal)}`);
                } else if (orOp === 'is') {
                  if (cleanVal === 'null') {
                    orParts.push(`"${orCol}" IS NULL`);
                  } else {
                    orParts.push(`"${orCol}" IS ${addParam(cleanVal === 'true' ? true : cleanVal === 'false' ? false : cleanVal)}`);
                  }
                }
              }
            }
          }
          if (orParts.length > 0) {
            parts.push(`(${orParts.join(' OR ')})`);
          }
        }
      }
      if (parts.length > 0) {
        whereClause = ' WHERE ' + parts.join(' AND ');
      }
    }

    if (action === 'select') {
      let selectCols = '*';
      if (select && typeof select === 'string' && select !== '*') {
        const parts = select.split(',').map(s => s.trim());
        const valid = parts.every(p => /^[a-zA-Z0-9_:\s\*]+$/.test(p) || p.includes('(') || p.includes(')'));
        if (valid) {
          selectCols = parts.map(p => {
            if (/^[a-zA-Z0-9_]+$/.test(p)) return `"${p}"`;
            return p;
          }).join(', ');
        }
      }
      
      sql = `SELECT ${selectCols} FROM "${table}"${whereClause}`;
      
      if (order && order.column) {
        if (/^[a-zA-Z0-9_]+$/.test(order.column)) {
          sql += ` ORDER BY "${order.column}" ${order.ascending ? 'ASC' : 'DESC'}`;
        }
      }
      
      if (typeof limit === 'number') {
        sql += ` LIMIT ${limit}`;
      }

      console.log(`[VPS Fallback Query] Running: ${sql} with params:`, queryParams);
      const { rows } = await db.query(sql, queryParams);
      
      if (single || maybeSingle) {
        return res.json({ data: rows[0] || null, error: null });
      }
      return res.json({ data: rows, error: null });

    } else if (action === 'insert') {
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Data object required for insert' });
      }

      const rowsToInsert = Array.isArray(data) ? data : [data];
      if (rowsToInsert.length === 0) {
        return res.json({ data: [], error: null });
      }

      const allColsSet = new Set();
      for (const row of rowsToInsert) {
        Object.keys(row).forEach(k => allColsSet.add(k));
      }
      const cols = Array.from(allColsSet);
      for (const col of cols) {
        if (!/^[a-zA-Z0-9_]+$/.test(col)) {
          return res.status(400).json({ error: `Invalid column name in insert: ${col}` });
        }
      }

      const valueRows = [];
      for (const row of rowsToInsert) {
        const valuePlaceholders = [];
        for (const col of cols) {
          valuePlaceholders.push(addParam(row[col] !== undefined ? row[col] : null));
        }
        valueRows.push(`(${valuePlaceholders.join(', ')})`);
      }

      sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES ${valueRows.join(', ')} RETURNING *`;
      console.log(`[VPS Fallback Insert] Running: ${sql} with params:`, queryParams);
      const { rows } = await db.query(sql, queryParams);
      
      if (!Array.isArray(data) && rows.length > 0) {
        return res.json({ data: rows[0], error: null });
      }
      return res.json({ data: rows, error: null });

    } else if (action === 'update') {
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Data object required for update' });
      }

      const keys = Object.keys(data);
      const setClauses = [];
      for (const key of keys) {
        if (!/^[a-zA-Z0-9_]+$/.test(key)) {
          return res.status(400).json({ error: `Invalid column name in update: ${key}` });
        }
        setClauses.push(`"${key}" = ${addParam(data[key])}`);
      }

      sql = `UPDATE "${table}" SET ${setClauses.join(', ')}${whereClause} RETURNING *`;
      console.log(`[VPS Fallback Update] Running: ${sql} with params:`, queryParams);
      const { rows } = await db.query(sql, queryParams);
      return res.json({ data: rows, error: null });

    } else if (action === 'upsert') {
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Data object required for upsert' });
      }

      const rowsToInsert = Array.isArray(data) ? data : [data];
      if (rowsToInsert.length === 0) {
        return res.json({ data: [], error: null });
      }

      const allColsSet = new Set();
      for (const row of rowsToInsert) {
        Object.keys(row).forEach(k => allColsSet.add(k));
      }
      const cols = Array.from(allColsSet);
      for (const col of cols) {
        if (!/^[a-zA-Z0-9_]+$/.test(col)) {
          return res.status(400).json({ error: `Invalid column name in upsert: ${col}` });
        }
      }

      const valueRows = [];
      for (const row of rowsToInsert) {
        const valuePlaceholders = [];
        for (const col of cols) {
          valuePlaceholders.push(addParam(row[col] !== undefined ? row[col] : null));
        }
        valueRows.push(`(${valuePlaceholders.join(', ')})`);
      }

      let conflictTarget = 'id';
      if (table === 'attendance_logs') {
        conflictTarget = 'employee_id, date';
      } else if (table === 'user_roles') {
        conflictTarget = 'user_id';
      } else if (table === 'user_sessions') {
        conflictTarget = 'id';
      }

      const updateClauses = cols
        .filter(c => c !== 'id' && c !== 'employee_id' && c !== 'date' && c !== 'user_id')
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');

      sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES ${valueRows.join(', ')}`;
      if (updateClauses.length > 0) {
        sql += ` ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateClauses}`;
      } else {
        sql += ` ON CONFLICT (${conflictTarget}) DO NOTHING`;
      }
      sql += ' RETURNING *';

      console.log(`[VPS Fallback Upsert] Running: ${sql} with params:`, queryParams);
      const { rows } = await db.query(sql, queryParams);
      
      if (!Array.isArray(data) && rows.length > 0) {
        return res.json({ data: rows[0], error: null });
      }
      return res.json({ data: rows, error: null });

    } else if (action === 'delete') {
      sql = `DELETE FROM "${table}"${whereClause} RETURNING *`;
      console.log(`[VPS Fallback Delete] Running: ${sql} with params:`, queryParams);
      const { rows } = await db.query(sql, queryParams);
      return res.json({ data: rows, error: null });
      
    } else {
      return res.status(400).json({ error: `Action '${action}' is not supported.` });
    }
  } catch (err) {
    console.error('[VPS Fallback Query Error]:', err.message || err);
    return res.status(500).json({ error: err.message || 'VPS Query execution failed' });
  }
});

// --- PostgreSQL LISTEN/NOTIFY Real-Time Sync ---
const { Client } = require('pg');

let pgListenerRetries = 0;
const MAX_PG_LISTENER_RETRIES = 5;

async function startPgListener() {
  if (pgListenerRetries >= MAX_PG_LISTENER_RETRIES) {
    console.warn(`⚠️ PG Listener connection failed ${MAX_PG_LISTENER_RETRIES} times. Reconnection disabled to prevent log spam. Please ensure PostgreSQL is running at ${process.env.PG_HOST || '127.0.0.1'}:${process.env.PG_PORT || '5432'} and restart the server.`);
    return;
  }

  const pgClient = new Client({
    user: process.env.PG_USER || 'erp_admin',
    host: process.env.PG_HOST || '127.0.0.1',
    database: process.env.PG_DATABASE || 'shastika_erp',
    password: process.env.PG_PASSWORD,
    port: parseInt(process.env.PG_PORT || '5432', 10)
      });

  pgClient.on('error', (err) => {
    console.error('❌ PG Listener Client Error:', err.message);
    pgListenerRetries++;
    // Try to reconnect after a delay
    setTimeout(startPgListener, 5000);
  });

  pgClient.on('end', () => {
    console.log('🔌 PG Listener Client connection ended.');
  });

  try {
    await pgClient.connect();
    pgListenerRetries = 0; // Reset on successful connection
    console.log('🔌 Dedicated PG Listener Client connected.');
    
    await pgClient.query('LISTEN data_changed');
    console.log('👂 Listening to PG channel "data_changed"');

    pgClient.on('notification', (msg) => {
      console.log(`🔔 Received PG notify on "data_changed": ${msg.payload}`);
      
      // Broadcast disabled (Supabase removed). If needed, local websocket can be implemented.
    });
  } catch (err) {
    console.error('❌ Failed to connect PG Listener:', err.message);
    pgListenerRetries++;
    setTimeout(startPgListener, 5000);
  }
}

// Start PG listener
startPgListener();

// Start Server
const ensureUserPermissionsSetup = async () => {
  // Local VPS DB only holds: attendance_logs, drivers, vehicles, AttLogs, etc.
};

const startServer = async () => {	
  await ensureUserPermissionsSetup();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🟢 ADMS Sync Server is listening on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch(err => {
  console.error('❌ Failed to start ADMS Sync Server:', err);
  process.exit(1);
});


