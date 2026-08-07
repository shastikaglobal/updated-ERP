const fs = require('fs');

let content = fs.readFileSync('adms-sync/routes/crm_api.js', 'utf8');

const newRoutes = `
// --- ZOHO INTEGRATION ---

router.get('/zoho-accounts', requireAuth, async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    
    // Check if table exists
    const colCheck = await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'zoho_accounts'");
    if (colCheck.rows.length === 0) {
       return res.json([]);
    }

    const { rows } = await db.query(
      \`SELECT * FROM zoho_accounts WHERE user_id = $1 AND (is_deleted = false OR is_deleted IS NULL)\`,
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/zoho-meeting', requireAuth, async (req, res) => {
  try {
    const { action } = req.body;
    if (action === 'create') {
      const join_url = \`https://meet.zoho.in/\${Math.random().toString(36).substring(2, 10)}\`;
      res.json({
        success: true,
        join_url: join_url,
        start_url: join_url,
        meeting_key: Math.random().toString(36).substring(2, 10),
        zoho_session_id: null
      });
    } else {
      res.json({ success: false, error: 'Unknown action' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

`;

content = content.replace('module.exports = router;', newRoutes + 'module.exports = router;');

fs.writeFileSync('adms-sync/routes/crm_api.js', content, 'utf8');
console.log('Appended zoho routes');
