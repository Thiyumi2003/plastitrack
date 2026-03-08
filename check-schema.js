const mysql = require('./server/node_modules/mysql2/promise');
require('dotenv').config({ path: './server/.env' });

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'plastritack',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const conn = await pool.getConnection();
    const [cols] = await conn.query(
      'SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "images" AND TABLE_SCHEMA = DATABASE() ORDER BY ORDINAL_POSITION'
    );

    console.log('\n✅ Images Table Schema:\n');
    console.log('Old columns (should NOT exist):');
    console.log('  - assigned_to:', cols.some(c => c.COLUMN_NAME === 'assigned_to') ? '❌ EXISTS' : '✓ REMOVED');
    console.log('  - feedback:', cols.some(c => c.COLUMN_NAME === 'feedback') ? '❌ EXISTS' : '✓ REMOVED');
    console.log('  - uploaded_at:', cols.some(c => c.COLUMN_NAME === 'uploaded_at') ? '❌ EXISTS' : '✓ REMOVED');

    console.log('\nNew columns (should exist):');
    console.log('  - admin_id:', cols.some(c => c.COLUMN_NAME === 'admin_id') ? '✓ EXISTS' : '❌ MISSING');
    console.log('  - annotator_feedback:', cols.some(c => c.COLUMN_NAME === 'annotator_feedback') ? '✓ EXISTS' : '❌ MISSING');
    console.log('  - tester_feedback:', cols.some(c => c.COLUMN_NAME === 'tester_feedback') ? '✓ EXISTS' : '❌ MISSING');
    console.log('  - melbourne_user_feedback:', cols.some(c => c.COLUMN_NAME === 'melbourne_user_feedback') ? '✓ EXISTS' : '❌ MISSING');

    console.log('\nAll columns:');
    cols.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.COLUMN_NAME} (${c.COLUMN_TYPE})`);
    });

    conn.release();
    pool.end();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
