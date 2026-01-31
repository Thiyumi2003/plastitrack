const mysql = require("mysql2/promise");
require("dotenv").config();

async function checkData() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("✓ Connected to database\n");

    // Check work hours
    const [workHours] = await connection.execute(`
      SELECT 
        wh.id,
        wh.admin_id,
        u.name as admin_name,
        wh.date,
        wh.hours_worked,
        wh.status
      FROM work_hours wh
      JOIN users u ON wh.admin_id = u.id
      ORDER BY wh.date DESC
    `);

    console.log("📊 Work Hours Data:");
    console.table(workHours);

    // Check payments
    const [payments] = await connection.execute(`
      SELECT 
        p.id,
        u.name as user_name,
        p.amount,
        p.model_type,
        p.status
      FROM payments p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);

    console.log("\n💰 Payments Data:");
    console.table(payments);

    // Check users
    const [users] = await connection.execute(`
      SELECT id, name, email, role, hourly_rate 
      FROM users 
      ORDER BY id
    `);

    console.log("\n👥 Users Data:");
    console.table(users);

    await connection.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

checkData();
