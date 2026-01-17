const mysql = require("mysql2/promise");
require("dotenv").config();

async function initDatabase() {
  let connection;
  try {
    // First connection without database to create it
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    // Create database if not exists
    const dbName = process.env.DB_NAME;
    const createDbQuery = `CREATE DATABASE IF NOT EXISTS \`${dbName}\``;
    await connection.query(createDbQuery);
    console.log(`✓ Database ${dbName} created or already exists`);

    // Connect to the database
    await connection.changeUser({ database: dbName });

    // Create users table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'admin', 'annotator', 'tester', 'melbourne_user') DEFAULT 'annotator',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    await connection.query(createTableQuery);
    console.log("✓ Users table created or already exists");

    // Create OTP codes table for password reset
    const createOtpTableQuery = `
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        purpose ENUM('registration', 'password_reset') DEFAULT 'password_reset',
        expires_at TIMESTAMP,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await connection.query(createOtpTableQuery);
    console.log("✓ OTP codes table created or already exists");

    // Create a sample admin user if it doesn't exist
    const [existingAdmin] = await connection.query(
      "SELECT id FROM users WHERE email = 'admin@plastitrack.com'"
    );

    if (existingAdmin.length === 0) {
      const bcrypt = require("bcryptjs");
      
      // Hash passwords for all users
      const adminPassword = await bcrypt.hash("admin123", 10);
      const superAdminPassword = await bcrypt.hash("superadmin123", 10);
      const annotatorPassword = await bcrypt.hash("annotator123", 10);
      const testerPassword = await bcrypt.hash("tester123", 10);
      const melbournePassword = await bcrypt.hash("melbourne123", 10);

      // Insert all users
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Admin User", "admin@plastitrack.com", adminPassword, "admin"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Super Admin User", "superadmin@plastitrack.com", superAdminPassword, "super_admin"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Annotator User", "annotator@plastitrack.com", annotatorPassword, "annotator"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Tester User", "tester@plastitrack.com", testerPassword, "tester"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Melbourne User", "melbourne@plastitrack.com", melbournePassword, "melbourne_user"]
      );

      console.log("✓ Sample users created:");
      console.log("  - Admin: admin@plastitrack.com / admin123");
      console.log("  - Super Admin: superadmin@plastitrack.com / superadmin123");
      console.log("  - Annotator: annotator@plastitrack.com / annotator123");
      console.log("  - Tester: tester@plastitrack.com / tester123");
      console.log("  - Melbourne User: melbourne@plastitrack.com / melbourne123");
    }

    await connection.end();
    console.log("✓ Database initialization complete!");
  } catch (err) {
    console.error("✗ Database initialization failed:", err.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

initDatabase();
