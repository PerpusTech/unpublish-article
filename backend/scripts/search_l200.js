const mysql = require('mysql2/promise');

async function search() {
  const pool = mysql.createPool({
    host: process.env.EPRINTS_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.EPRINTS_DB_PORT || '3306', 10),
    user: process.env.EPRINTS_DB_USER || '',
    password: process.env.EPRINTS_DB_PASSWORD || '',
    database: process.env.EPRINTS_DB_NAME || 'etd2018',
    waitForConnections: true,
    connectionLimit: 5,
  });

  console.log('[1] Checking direct matches on eprint table...');
  const [eRows] = await pool.query('SELECT eprintid, title, id_number, eprint_status FROM eprint WHERE id_number LIKE ? OR title LIKE ?', ['%L200190128%', '%L200190128%']);
  console.log('eprint table result:', eRows);

  console.log('[2] Checking all text columns in database etd2018...');
  const [cols] = await pool.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'etd2018' AND DATA_TYPE IN ('varchar', 'text', 'mediumtext', 'longtext', 'char')"
  );

  for (const c of cols) {
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${c.TABLE_NAME}\` WHERE \`${c.COLUMN_NAME}\` LIKE ? LIMIT 5`, ['%L200190128%']);
      if (rows && rows.length > 0) {
        console.log(`>>> MATCH FOUND in ${c.TABLE_NAME}.${c.COLUMN_NAME}:`, rows);
      }
    } catch (err) {
      // skip
    }
  }

  console.log('[3] Checking case-insensitive variations (e.g. l200190128, L 200 190 128, etc)...');
  const [likeRows] = await pool.query("SELECT eprintid, title, id_number, eprint_status FROM eprint WHERE LOWER(id_number) LIKE '%l200190128%' OR id_number LIKE '%190128%'");
  console.log('Pattern %190128% in id_number:', likeRows);

  await pool.end();
}

search().catch(console.error);
