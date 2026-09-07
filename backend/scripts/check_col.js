const mysql = require('mysql2/promise');

async function checkCollation() {
  const pool = mysql.createPool({
    host: process.env.EPRINTS_DB_HOST || '10.12.0.6',
    port: parseInt(process.env.EPRINTS_DB_PORT || '3306', 10),
    user: process.env.EPRINTS_DB_USER || 'asharul',
    password: process.env.EPRINTS_DB_PASSWORD || 'Ash@2026',
    database: process.env.EPRINTS_DB_NAME || 'etd2018',
    waitForConnections: true,
    connectionLimit: 5,
  });

  const [cols] = await pool.query("SHOW FULL COLUMNS FROM eprint WHERE Field IN ('id_number', 'nim', 'title', 'abstract')");
  console.log('Columns collation:', cols.map(c => ({ Field: c.Field, Type: c.Type, Collation: c.Collation })));

  const [testLower] = await pool.query("SELECT eprintid, title, id_number FROM eprint WHERE LOWER(id_number) LIKE ? OR LOWER(nim) LIKE ?", ['%l200190128%', '%l200190128%']);
  console.log('Test LOWER(id_number) LIKE %l200190128%:', testLower);

  await pool.end();
}

checkCollation().catch(console.error);
