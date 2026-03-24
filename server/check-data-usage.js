const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '1234',
      database: 'plastritack'
    });
    
    console.log('\n=== ADMIN_SESSIONS TABLE DATA ===');
    const [sessions] = await conn.query(`
      SELECT id, admin_id, login_time, logout_time, session_duration, 
             start_time, end_time, active_minutes, status, created_at
      FROM admin_sessions 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.table(sessions);
    
    console.log('\n=== WORK_HOURS TABLE DATA (Latest) ===');
    const [workHours] = await conn.query(`
      SELECT id, admin_id, date, minutes_worked, pending_minutes, 
             approved_minutes, paid_minutes, status, is_auto_tracked
      FROM work_hours 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.table(workHours);
    
    console.log('\n=== DATA CONSISTENCY CHECK ===');
    const [check] = await conn.query(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN login_time IS NOT NULL THEN 1 ELSE 0 END) as with_login_time,
        SUM(CASE WHEN logout_time IS NOT NULL THEN 1 ELSE 0 END) as with_logout_time,
        SUM(CASE WHEN session_duration IS NOT NULL THEN 1 ELSE 0 END) as with_duration,
        SUM(CASE WHEN active_minutes > 0 THEN 1 ELSE 0 END) as with_active_minutes
      FROM admin_sessions
    `);
    
    console.table(check);
    
    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
