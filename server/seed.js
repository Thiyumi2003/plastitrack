const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function seedSampleData() {
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log("✓ Connected to database");

    // Read SQL file
    const sqlFile = path.join(__dirname, "db", "seed_sample_data.sql");
    const sqlContent = fs.readFileSync(sqlFile, "utf8");

    // Execute SQL
    await connection.query(sqlContent);
    console.log("✓ Sample data inserted successfully!");

    // Show summary
    const [workHoursCount] = await connection.execute("SELECT COUNT(*) as count FROM work_hours");
    const [paymentsCount] = await connection.execute("SELECT COUNT(*) as count FROM payments");
    const [sessionsCount] = await connection.execute("SELECT COUNT(*) as count FROM admin_sessions");

    console.log("\n📊 Database Summary:");
    console.log(`  - Work Hours: ${workHoursCount[0].count} entries`);
    console.log(`  - Payments: ${paymentsCount[0].count} records`);
    console.log(`  - Admin Sessions: ${sessionsCount[0].count} sessions`);

    await connection.end();
    console.log("\n✅ Seeding complete!");
  } catch (err) {
    console.error("❌ Error seeding data:", err.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

seedSampleData();
