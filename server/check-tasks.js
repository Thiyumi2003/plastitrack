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

    // Check tasks with notes
    const [tasks] = await conn.query(`
      SELECT t.id, t.image_id, t.notes, t.task_type, i.image_name, i.annotator_feedback
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      WHERE t.task_type = 'annotation' AND t.notes IS NOT NULL AND t.notes != ''
      LIMIT 10
    `);
    
    console.log('\n📝 Tasks with annotation notes:\n');
    
    if (tasks.length === 0) {
      console.log('❌ No annotation tasks with notes found');
    } else {
      tasks.forEach((task, idx) => {
        console.log(`\n--- Task ${idx + 1} ---`);
        console.log(`Image: ${task.image_name}`);
        console.log(`Task Notes: ${task.notes}`);
        console.log(`Current annotator_feedback in images table: ${task.annotator_feedback || '❌ NULL'}`);
      });
    }

    conn.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
