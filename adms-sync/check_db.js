const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/erp_db' });
async function run() {
  const res = await pool.query("SELECT table_name FROM information_schema.columns WHERE column_name = 'company_id'");
  console.log("Tables with company_id:", res.rows.map(r => r.table_name));
  pool.end();
}
run().catch(err => {
    console.error(err);
    // Maybe DB is on another port or password is wrong, check adms-sync/.env
});
