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

    // Create images table
    const createImagesTableQuery = `
      CREATE TABLE IF NOT EXISTS images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_name VARCHAR(255) NOT NULL,
        model_type VARCHAR(100),
        status ENUM('pending', 'in_progress', 'completed', 'approved', 'rejected') DEFAULT 'pending',
        assigned_to INT,
        annotator_id INT,
        tester_id INT,
        objects_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (annotator_id) REFERENCES users(id),
        FOREIGN KEY (tester_id) REFERENCES users(id)
      )
    `;
    await connection.query(createImagesTableQuery);
    console.log("✓ Images table created or already exists");

    // Create tasks table
    const createTasksTableQuery = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_id INT NOT NULL,
        user_id INT NOT NULL,
        task_type ENUM('annotation', 'validation', 'testing') DEFAULT 'annotation',
        status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_date TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;
    await connection.query(createTasksTableQuery);
    console.log("✓ Tasks table created or already exists");

    // Create payments table
    const createPaymentsTableQuery = `
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        model_type VARCHAR(100),
        images_completed INT DEFAULT 0,
        status ENUM('pending', 'approved', 'paid', 'rejected') DEFAULT 'pending',
        payment_method VARCHAR(100),
        payment_date TIMESTAMP,
        approved_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;
    await connection.query(createPaymentsTableQuery);
    console.log("✓ Payments table created or already exists");

    // Create a sample admin user if it doesn't exist
    const [existingAdmin] = await connection.query(
      "SELECT id FROM users WHERE email = 'tharuka@gmail.com'"
    );

    if (existingAdmin.length === 0) {
      const bcrypt = require("bcryptjs");
      
      // Hash passwords for all users
      const adminPassword = await bcrypt.hash("tharuka123", 10);
      const superAdminPassword = await bcrypt.hash("dinesh123", 10);
      const annotatorPassword = await bcrypt.hash("thiyumi123", 10);
      const testerPassword = await bcrypt.hash("nipun123", 10);
      const melbournePassword = await bcrypt.hash("melbourne123", 10);

      // Insert all users
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Tharuka Sadaruwan", "tharuka@gmail.com", adminPassword, "admin"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Dinesh Asanka", "dineshasanka@gmail.com", superAdminPassword, "super_admin"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Thiyumi Upasari", "thiyumiupasari2003@gmail.com", annotatorPassword, "annotator"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Nipun Jayakody", "nipunjayakody110@gmail.com", testerPassword, "tester"]
      );
      
      await connection.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Melbourne User", "melbourne@plastitrack.com", melbournePassword, "melbourne_user"]
      );

      console.log("✓ Sample users created:");
      console.log("  - Admin: tharuka@gmail.com / tharuka123");
      console.log("  - Super Admin: dineshasanka@gmail.com / dinesh123");
      console.log("  - Annotator: thiyumiupasari2003@gmail.com / thiyumi123");
      console.log("  - Tester: nipunjayakody110@gmail.com / nipun123");
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
