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

    const [images] = await conn.query('SELECT * FROM images LIMIT 5');
    
    console.log('\n📊 Sample Images Data:\n');
    
    if (images.length === 0) {
      console.log('❌ No data in images table');
    } else {
      images.forEach((img, idx) => {
        console.log(`\n--- Image ${idx + 1} ---`);
        console.log(`ID: ${img.id}`);
        console.log(`Image Name: ${img.image_name}`);
        console.log(`Model Type: ${img.model_type || '❌ NULL/EMPTY'}`);
        console.log(`Status: ${img.status}`);
        console.log(`Admin ID: ${img.admin_id || 'NULL'}`);
        console.log(`Annotator ID: ${img.annotator_id || 'NULL'}`);
        console.log(`Annotator Feedback: ${img.annotator_feedback || '❌ NULL/EMPTY'}`);
        console.log(`Tester ID: ${img.tester_id || 'NULL'}`);
        console.log(`Tester Feedback: ${img.tester_feedback || 'NULL/EMPTY'}`);
        console.log(`Objects Count: ${img.objects_count}`);
      });
    }

    conn.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
