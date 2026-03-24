const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '1234',
      database: 'plastritack'
    });
    
    const [cols] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'admin_sessions' 
      AND TABLE_SCHEMA = 'plastritack' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nAdmin Sessions Table Columns:');
    cols.forEach(c => console.log('  -', c.COLUMN_NAME));
    
    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
