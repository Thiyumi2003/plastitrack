const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    const [cols] = await conn.query('DESC images');
    
    console.log('\n✅ Images Table Column Order (Correct):\n');
    cols.forEach((c, i) => {
      const num = (i+1).toString().padStart(2);
      const field = c.Field.padEnd(25);
      console.log(`${num}.  ${field} ${c.Type}`);
    });

    conn.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
