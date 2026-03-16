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
        status ENUM('pending', 'in_progress', 'completed', 'pending_review', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        admin_id INT,
        annotator_id INT,
        annotator_feedback TEXT,
        tester_id INT,
        tester_feedback TEXT,
        melbourne_user_id INT,
        melbourne_user_feedback TEXT,
        objects_count INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        previous_tester_name VARCHAR(255) NULL,
        previous_feedback TEXT NULL,
        FOREIGN KEY (admin_id) REFERENCES users(id),
        FOREIGN KEY (annotator_id) REFERENCES users(id),
        FOREIGN KEY (tester_id) REFERENCES users(id),
        FOREIGN KEY (melbourne_user_id) REFERENCES users(id)
      )
    `;
    await connection.query(createImagesTableQuery);
    console.log("✓ Images table created or already exists");

    // Ensure new columns exist for legacy tables (compatible with older MySQL)
    const ensureColumn = async (table, column, definition) => {
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      } catch (err) {
        if (err.code === "ER_DUP_FIELDNAME") {
          return;
        }
        console.error(`Alter table failed for ${table}.${column}:`, err);
        throw err;
      }
    };

    // Safely drop a column if it exists
    const dropColumnIfExists = async (table, column) => {
      try {
        // Check if column exists
        const [rows] = await connection.query(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        if (rows[0]?.cnt > 0) {
          await connection.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
          console.log(`✓ Dropped column ${table}.${column}`);
        }
      } catch (err) {
        console.warn(`Could not drop column ${table}.${column} (may not exist):`, err.code || err.message);
      }
    };

    // Remove deprecated columns from images - need to handle foreign keys
    console.log("🔄 Starting schema migration for images table...");
    
    // First, get all foreign keys on the images table
    const [foreignKeys] = await connection.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'images' AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log(`Found ${foreignKeys.length} foreign keys on images table`);
    
    // Drop any foreign keys that reference old columns (assigned_to)
    for (const fk of foreignKeys) {
      if (fk.COLUMN_NAME === 'assigned_to') {
        try {
          await connection.query(`ALTER TABLE images DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
          console.log(`✓ Dropped foreign key ${fk.CONSTRAINT_NAME} on assigned_to`);
        } catch (err) {
          console.warn(`Could not drop FK ${fk.CONSTRAINT_NAME}:`, err.message);
        }
      }
    }

    // Now drop the old columns
    await dropColumnIfExists("images", "file_size");
    await dropColumnIfExists("images", "filepath");
    await dropColumnIfExists("images", "feedback");
    await dropColumnIfExists("images", "uploaded_at");
    await dropColumnIfExists("images", "assigned_to");
    await dropColumnIfExists("images", "rejected_at");
    await dropColumnIfExists("images", "previous_annotator_name");
    await dropColumnIfExists("images", "previous_rejected_at");
    
    // Ensure new columns exist
    await ensureColumn("images", "admin_id", "INT");
    await ensureColumn("images", "annotator_feedback", "TEXT NULL");
    await ensureColumn("images", "tester_feedback", "TEXT NULL");
    await ensureColumn("images", "melbourne_user_feedback", "TEXT NULL");
    await ensureColumn("images", "previous_tester_name", "VARCHAR(255) NULL");
    await ensureColumn("images", "previous_feedback", "TEXT NULL");
    
    // Data migration: Extract model_type from image_name if NULL
    try {
      const [imagesToFix] = await connection.query(`
        SELECT id, image_name FROM images WHERE model_type IS NULL OR model_type = ''
      `);
      
      if (imagesToFix.length > 0) {
        console.log(`🔄 Fixing ${imagesToFix.length} images with missing model_type...`);
        for (const img of imagesToFix) {
          // Extract model type from image name pattern (e.g., "PET_01_2300_2400" -> "PET")
          const match = img.image_name.match(/^([A-Z]+)_/);
          if (match) {
            await connection.query(
              `UPDATE images SET model_type = ? WHERE id = ?`,
              [match[1], img.id]
            );
          }
        }
        console.log(`✓ Fixed model_type for ${imagesToFix.length} images`);
      }
    } catch (err) {
      console.warn("Could not fix model_type:", err.message);
    }
    
    // Data migration: Copy annotation task notes to annotator_feedback
    try {
      const [tasksWithNotes] = await connection.query(`
        SELECT t.image_id, t.notes
        FROM tasks t
        INNER JOIN images i ON t.image_id = i.id
        WHERE t.task_type = 'annotation' 
          AND t.status = 'completed'
          AND t.notes IS NOT NULL 
          AND t.notes != ''
          AND (i.annotator_feedback IS NULL OR i.annotator_feedback = '')
        ORDER BY t.completed_date DESC
      `);
      
      if (tasksWithNotes.length > 0) {
        console.log(`🔄 Migrating ${tasksWithNotes.length} annotation notes to annotator_feedback...`);
        const uniqueImages = new Map();
        // Keep only the latest note for each image
        tasksWithNotes.forEach(task => {
          if (!uniqueImages.has(task.image_id)) {
            uniqueImages.set(task.image_id, task.notes);
          }
        });
        
        for (const [imageId, notes] of uniqueImages) {
          await connection.query(
            `UPDATE images SET annotator_feedback = ? WHERE id = ?`,
            [notes, imageId]
          );
        }
        console.log(`✓ Migrated annotator feedback for ${uniqueImages.size} images`);
      }
    } catch (err) {
      console.warn("Could not migrate annotator feedback:", err.message);
    }
    
    // Data migration: Copy tester task notes to tester_feedback
    try {
      const [testerTasks] = await connection.query(`
        SELECT t.image_id, t.notes
        FROM tasks t
        INNER JOIN images i ON t.image_id = i.id
        WHERE t.task_type = 'testing'
          AND t.notes IS NOT NULL 
          AND t.notes != ''
          AND (i.tester_feedback IS NULL OR i.tester_feedback = '')
        ORDER BY t.completed_date DESC
      `);
      
      if (testerTasks.length > 0) {
        console.log(`🔄 Migrating ${testerTasks.length} tester notes to tester_feedback...`);
        const uniqueImages = new Map();
        testerTasks.forEach(task => {
          if (!uniqueImages.has(task.image_id)) {
            uniqueImages.set(task.image_id, task.notes);
          }
        });
        
        for (const [imageId, notes] of uniqueImages) {
          await connection.query(
            `UPDATE images SET tester_feedback = ? WHERE id = ?`,
            [notes, imageId]
          );
        }
        console.log(`✓ Migrated tester feedback for ${uniqueImages.size} images`);
      }
    } catch (err) {
      console.warn("Could not migrate tester feedback:", err.message);
    }
    
    // Add foreign key constraint for admin_id if it doesn't exist
    try {
      await connection.query(`ALTER TABLE images ADD CONSTRAINT admin_id_fk FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL`);
      console.log(`✓ Added foreign key constraint on images.admin_id`);
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_FK_DUP_NAME') {
        console.log(`✓ Foreign key constraint admin_id_fk already exists`);
      } else {
        console.warn("Could not add admin_id FK:", err.code);
      }
    }
    
    // Ensure images status enum supports review flow
    try {
      await connection.query(`ALTER TABLE images MODIFY status ENUM('pending', 'in_progress', 'completed', 'pending_review', 'approved', 'rejected') DEFAULT 'pending'`);
      console.log(`✓ Updated images status enum`);
    } catch (err) {
      // Ignore if already migrated
      console.warn("Status enum update (may already be complete):", err.code);
    }
    
    // Reorganize column order for images table
    try {
      console.log("🔄 Reorganizing images table column order...");
      // Reorder columns: id, image_name, model_type, status, created_at, admin_id, annotator_id, annotator_feedback, tester_id, tester_feedback, melbourne_user_id, melbourne_user_feedback, objects_count, updated_at, previous_tester_name, previous_feedback
      await connection.query(`ALTER TABLE images MODIFY created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER status`);
      await connection.query(`ALTER TABLE images MODIFY admin_id INT AFTER created_at`);
      await connection.query(`ALTER TABLE images MODIFY annotator_id INT AFTER admin_id`);
      await connection.query(`ALTER TABLE images MODIFY annotator_feedback TEXT AFTER annotator_id`);
      await connection.query(`ALTER TABLE images MODIFY tester_id INT AFTER annotator_feedback`);
      await connection.query(`ALTER TABLE images MODIFY tester_feedback TEXT AFTER tester_id`);
      await connection.query(`ALTER TABLE images MODIFY melbourne_user_id INT AFTER tester_feedback`);
      await connection.query(`ALTER TABLE images MODIFY melbourne_user_feedback TEXT AFTER melbourne_user_id`);
      await connection.query(`ALTER TABLE images MODIFY objects_count INT DEFAULT 0 AFTER melbourne_user_feedback`);
      await connection.query(`ALTER TABLE images MODIFY updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER objects_count`);
      await connection.query(`ALTER TABLE images MODIFY previous_tester_name VARCHAR(255) NULL AFTER updated_at`);
      await connection.query(`ALTER TABLE images MODIFY previous_feedback TEXT NULL AFTER previous_tester_name`);
      console.log(`✓ Images table column order reorganized`);
    } catch (err) {
      console.warn("Could not reorganize column order:", err.code || err.message);
    }
    
    console.log("✓ Schema migration complete");
    await ensureColumn("users", "last_login", "TIMESTAMP NULL");
    await ensureColumn("users", "profile_picture", "VARCHAR(255) NULL");

    // Create image history table for full image set lifecycle timeline
    const createImageHistoryTableQuery = `
      CREATE TABLE IF NOT EXISTS image_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_id INT NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        status_from VARCHAR(50) NULL,
        status_to VARCHAR(50) NULL,
        actor_id INT NULL,
        actor_name VARCHAR(255) NULL,
        details TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users(id),
        INDEX idx_image_history_image_id (image_id),
        INDEX idx_image_history_created_at (created_at)
      )
    `;
    await connection.query(createImageHistoryTableQuery);
    console.log("✓ Image history table created or already exists");

    // Create tasks table
    const createTasksTableQuery = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(100) UNIQUE,
        image_id INT NOT NULL,
        user_id INT NOT NULL,
        assigned_by INT,
        task_type ENUM('annotation', 'validation', 'testing') DEFAULT 'annotation',
        status ENUM('pending', 'in_progress', 'completed', 'pending_review', 'approved', 'rejected') DEFAULT 'pending',
        notes TEXT,
        eligible_for_payment BOOLEAN DEFAULT TRUE,
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_date TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      )
    `;
    await connection.query(createTasksTableQuery);
    console.log("✓ Tasks table created or already exists");

    // Update tasks status enum to include review outcomes (migration-safe)
    try {
      await connection.query(`ALTER TABLE tasks MODIFY status ENUM('pending', 'in_progress', 'completed', 'pending_review', 'approved', 'rejected') DEFAULT 'pending'`);
    } catch (err) {
      // Ignore if already migrated
    }

    await ensureColumn("tasks", "task_id", "VARCHAR(100) UNIQUE");
    await ensureColumn("tasks", "assigned_by", "INT");
    await ensureColumn("tasks", "notes", "TEXT");
    await ensureColumn("tasks", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await ensureColumn("tasks", "eligible_for_payment", "BOOLEAN DEFAULT TRUE");

    // Fix foreign key constraint for cascade delete if it exists
    try {
      // Try to drop and recreate the constraint
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'tasks' AND COLUMN_NAME = 'image_id' AND REFERENCED_TABLE_NAME = 'images'
      `);
      
      if (constraints.length > 0) {
        const constraintName = constraints[0].CONSTRAINT_NAME;
        if (constraintName !== 'PRIMARY') {
          await connection.query(`ALTER TABLE tasks DROP FOREIGN KEY ${constraintName}`);
          console.log(`✓ Dropped old foreign key constraint: ${constraintName}`);
        }
      }
      
      // Add the new constraint with CASCADE DELETE
      await connection.query(`
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_image_cascade 
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
      `);
      console.log("✓ Updated tasks foreign key to use CASCADE DELETE");
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log("✓ CASCADE DELETE constraint already exists");
      } else if (err.message.includes("Constraint already exists")) {
        console.log("✓ CASCADE DELETE constraint already exists");
      } else {
        console.warn("Could not update CASCADE DELETE (may already be set):", err.code);
      }
    }

    // Create payments table
    const createPaymentsTableQuery = `
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        model_type VARCHAR(100),
        images_completed INT DEFAULT 0,
        status ENUM('pending_calculation', 'pending_approval', 'approved', 'ready_to_pay', 'paid', 'rejected') DEFAULT 'pending_calculation',
        objects_count INT DEFAULT 0,
        rate_used DECIMAL(10,2) DEFAULT 0,
        payment_method VARCHAR(100),
        payment_method_id INT NULL,
        payment_date TIMESTAMP,
        approved_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;
    await connection.query(createPaymentsTableQuery);
    console.log("✓ Payments table created or already exists");

    await ensureColumn("payments", "hours", "DECIMAL(10,2) DEFAULT 0");
    await ensureColumn("payments", "approved_by", "INT DEFAULT NULL");
    await ensureColumn("payments", "objects_count", "INT DEFAULT 0");
    await ensureColumn("payments", "rate_used", "DECIMAL(10,2) DEFAULT 0");
    await ensureColumn("payments", "payment_method_id", "INT NULL");
    await ensureColumn("payments", "paid_minutes", "INT DEFAULT 0 COMMENT 'For admin payments: number of minutes paid'");
    await ensureColumn("payments", "minute_rate", "DECIMAL(10,4) DEFAULT 0 COMMENT 'For admin payments: rate per minute'");

    // Safe status migration: allow legacy + new values, remap data, then enforce final enum.
    try {
      await connection.query(
        `ALTER TABLE payments MODIFY status ENUM('pending', 'pending_calculation', 'pending_approval', 'approved', 'ready', 'ready_to_pay', 'paid', 'rejected') DEFAULT 'pending_approval'`
      );
    } catch (err) {
      console.warn("Payments status temporary enum update:", err.code || err.message);
    }

    await connection.query("UPDATE payments SET status = 'pending_approval' WHERE status = 'pending'");
    await connection.query("UPDATE payments SET status = 'ready_to_pay' WHERE status = 'ready'");

    try {
      await connection.query(
        `ALTER TABLE payments MODIFY status ENUM('pending_calculation', 'pending_approval', 'approved', 'ready_to_pay', 'paid', 'rejected') DEFAULT 'pending_calculation'`
      );
      console.log("✓ Payments status enum upgraded");
    } catch (err) {
      console.warn("Payments status enum final update:", err.code || err.message);
    }
    
    // Add foreign key for approved_by if it doesn't exist
    try {
      await connection.query(`
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_approved_by 
        FOREIGN KEY (approved_by) REFERENCES users(id)
      `);
    } catch (err) {
      if (err.code === "ER_DUP_KEYNAME" || err.code === "ER_FK_DUP_NAME") {
        // Constraint already exists, that's fine
        console.log("✓ approved_by foreign key already exists");
      } else {
        console.warn("Could not add approved_by FK:", err.code);
      }
    }

    // Create payment methods table (store masked payment identifiers only)
    const createPaymentMethodsTableQuery = `
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        card_holder_name VARCHAR(255) NOT NULL,
        account_name VARCHAR(255) NULL,
        bank_name VARCHAR(120) NULL,
        branch_name VARCHAR(120) NULL,
        masked_card_number VARCHAR(25) NOT NULL,
        card_type VARCHAR(50) NOT NULL,
        expiry_month INT NOT NULL,
        expiry_year INT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_masked_card (user_id, masked_card_number),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) COMMENT 'Stores payment methods with masked card numbers only'
    `;
    await connection.query(createPaymentMethodsTableQuery);
    console.log("✓ Payment methods table created or already exists");

    await ensureColumn("payment_methods", "account_name", "VARCHAR(255) NULL AFTER card_holder_name");
    await ensureColumn("payment_methods", "bank_name", "VARCHAR(120) NULL AFTER account_name");
    await ensureColumn("payment_methods", "branch_name", "VARCHAR(120) NULL AFTER bank_name");
    await connection.query(
      "UPDATE payment_methods SET account_name = card_holder_name WHERE (account_name IS NULL OR account_name = '')"
    );

    // Add FK from payments.payment_method_id to payment_methods.id if missing.
    try {
      await connection.query(`
        ALTER TABLE payments
        ADD CONSTRAINT fk_payments_payment_method
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
      `);
    } catch (err) {
      if (err.code === "ER_DUP_KEYNAME" || err.code === "ER_FK_DUP_NAME") {
        console.log("✓ payment_method_id foreign key already exists");
      } else {
        console.warn("Could not add payment_method_id FK:", err.code || err.message);
      }
    }

    // Create notifications table
    const createNotificationsTableQuery = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        image_id INT,
        type ENUM('image_added', 'image_assigned_annotator', 'image_assigned_tester', 'image_completed', 'image_approved', 'image_rejected', 'task_updated', 'system') DEFAULT 'system',
        message TEXT NOT NULL,
        read_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (image_id) REFERENCES images(id),
        INDEX idx_user_read (user_id, read_status),
        INDEX idx_created_at (created_at)
      )
    `;
    await connection.query(createNotificationsTableQuery);
    console.log("✓ Notifications table created or already exists");

    // Create login logs table to track user logins
    const createLoginLogsTableQuery = `
      CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        user_agent TEXT,
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;
    await connection.query(createLoginLogsTableQuery);
    console.log("✓ Login logs table created or already exists");

    // Create work_hours table for tracking admin working hours
    const createWorkHoursTableQuery = `
      CREATE TABLE IF NOT EXISTS work_hours (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        date DATE NOT NULL,
        hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        task_description TEXT,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        approved_by INT,
        is_auto_tracked BOOLEAN DEFAULT FALSE COMMENT 'Whether this entry was automatically tracked',
        session_start DATETIME COMMENT 'Session start time for auto-tracked entries',
        session_end DATETIME COMMENT 'Session end time for auto-tracked entries',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_admin_date (admin_id, date),
        INDEX idx_status (status),
        INDEX idx_auto_tracked (is_auto_tracked)
      ) COMMENT 'Tracks admin working hours for payment calculation'
    `;
    await connection.query(createWorkHoursTableQuery);
    console.log("✓ Work hours table created or already exists");

    // Create admin_sessions table to track login/logout for automatic hour calculation
    const createAdminSessionsTableQuery = `
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        login_time DATETIME NOT NULL,
        logout_time DATETIME,
        session_duration DECIMAL(5,2) COMMENT 'Duration in hours',
        is_processed BOOLEAN DEFAULT FALSE COMMENT 'Whether hours have been added to work_hours',
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_admin_login (admin_id, login_time),
        INDEX idx_is_processed (is_processed)
      ) COMMENT 'Tracks admin login/logout sessions for automatic hour tracking'
    `;
    await connection.query(createAdminSessionsTableQuery);
    console.log("✓ Admin sessions table created or already exists");

    // Add hourly_rate and auto_track_hours columns to users table
    await ensureColumn("users", "hourly_rate", "DECIMAL(10,2) DEFAULT 1000.00 COMMENT 'Hourly rate for admin payments'");
    await ensureColumn("users", "annotator_rate", "DECIMAL(10,2) DEFAULT 0 COMMENT 'Rate per object for annotators'");
    await ensureColumn("users", "tester_rate", "DECIMAL(10,2) DEFAULT 0 COMMENT 'Rate per object for testers'");
    await ensureColumn("users", "auto_track_hours", "BOOLEAN DEFAULT TRUE COMMENT 'Auto-track working hours for admins'");
    await ensureColumn("users", "is_active", "BOOLEAN DEFAULT TRUE COMMENT 'User account active status'");

    // Create role-based default rates table
    const createRoleRatesTableQuery = `
      CREATE TABLE IF NOT EXISTS role_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name ENUM('annotator', 'tester', 'admin') NOT NULL,
        payment_type ENUM('per_object', 'per_hour') NOT NULL,
        default_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_role_payment (role_name, payment_type)
      ) COMMENT 'Stores default payment rates by role'
    `;
    await connection.query(createRoleRatesTableQuery);
    console.log("✓ Role rates table created or already exists");

    // Create user-specific custom override rates table
    const createUserRatesTableQuery = `
      CREATE TABLE IF NOT EXISTS user_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        payment_type ENUM('per_object', 'per_hour') NOT NULL,
        custom_rate DECIMAL(10,2) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_payment (user_id, payment_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) COMMENT 'Stores user-level payment rate overrides'
    `;
    await connection.query(createUserRatesTableQuery);
    console.log("✓ User rates table created or already exists");

    // Ensure sample users always exist (and keep superadmin credentials recoverable).
    const bcrypt = require("bcryptjs");
    const ensureSampleUser = async ({ name, email, password, role, forcePasswordReset = false }) => {
      const [rows] = await connection.query("SELECT id, role FROM users WHERE email = ?", [email]);
      const hashedPassword = await bcrypt.hash(password, 10);

      if (rows.length === 0) {
        await connection.query(
          "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
          [name, email, hashedPassword, role]
        );
        console.log(`✓ Seeded user ${email} (${role})`);
        return;
      }

      const existing = rows[0];
      if (existing.role !== role || forcePasswordReset) {
        await connection.query(
          "UPDATE users SET role = ?, password = ?, is_active = TRUE WHERE id = ?",
          [role, hashedPassword, existing.id]
        );
        console.log(`✓ Updated user ${email} role/password`);
      }
    };

    await ensureSampleUser({
      name: "Tharuka Sadaruwan",
      email: "tharuka@gmail.com",
      password: "tharuka123",
      role: "admin",
    });
    await ensureSampleUser({
      name: "Dinesh Asanka",
      email: "dineshasanka@gmail.com",
      password: "dinesh123",
      role: "super_admin",
      forcePasswordReset: true,
    });
    await ensureSampleUser({
      name: "Thiyumi Upasari",
      email: "thiyumiupasari2003@gmail.com",
      password: "thiyumi123",
      role: "annotator",
    });
    await ensureSampleUser({
      name: "Nipun Jayakody",
      email: "nipunjayakody110@gmail.com",
      password: "nipun123",
      role: "tester",
    });
    await ensureSampleUser({
      name: "Melbourne User",
      email: "melbourne@plastitrack.com",
      password: "melbourne123",
      role: "melbourne_user",
    });

    // Seed role defaults from existing legacy user rates where possible.
    await connection.query(
      `INSERT INTO role_rates (role_name, payment_type, default_rate)
       VALUES
         ('annotator', 'per_object', COALESCE((SELECT ROUND(AVG(annotator_rate), 2) FROM users WHERE role = 'annotator' AND annotator_rate IS NOT NULL), 0)),
         ('tester', 'per_object', COALESCE((SELECT ROUND(AVG(tester_rate), 2) FROM users WHERE role = 'tester' AND tester_rate IS NOT NULL), 0)),
         ('admin', 'per_hour', COALESCE((SELECT ROUND(AVG(hourly_rate), 2) FROM users WHERE role = 'admin' AND hourly_rate IS NOT NULL), 1000))
       ON DUPLICATE KEY UPDATE default_rate = default_rate`
    );
    console.log("✓ Role rates seeded (first run only)");

    // Backfill user override rates only when user-specific rate differs from role default.
    await connection.query(
      `INSERT INTO user_rates (user_id, payment_type, custom_rate)
       SELECT u.id, 'per_object', u.annotator_rate
       FROM users u
       JOIN role_rates rr ON rr.role_name = 'annotator' AND rr.payment_type = 'per_object'
       WHERE u.role = 'annotator'
         AND u.annotator_rate IS NOT NULL
         AND u.annotator_rate <> rr.default_rate
       ON DUPLICATE KEY UPDATE custom_rate = VALUES(custom_rate), updated_at = CURRENT_TIMESTAMP`
    );

    await connection.query(
      `INSERT INTO user_rates (user_id, payment_type, custom_rate)
       SELECT u.id, 'per_object', u.tester_rate
       FROM users u
       JOIN role_rates rr ON rr.role_name = 'tester' AND rr.payment_type = 'per_object'
       WHERE u.role = 'tester'
         AND u.tester_rate IS NOT NULL
         AND u.tester_rate <> rr.default_rate
       ON DUPLICATE KEY UPDATE custom_rate = VALUES(custom_rate), updated_at = CURRENT_TIMESTAMP`
    );

    await connection.query(
      `INSERT INTO user_rates (user_id, payment_type, custom_rate)
       SELECT u.id, 'per_hour', u.hourly_rate
       FROM users u
       JOIN role_rates rr ON rr.role_name = 'admin' AND rr.payment_type = 'per_hour'
       WHERE u.role = 'admin'
         AND u.hourly_rate IS NOT NULL
         AND u.hourly_rate <> rr.default_rate
       ON DUPLICATE KEY UPDATE custom_rate = VALUES(custom_rate), updated_at = CURRENT_TIMESTAMP`
    );
    console.log("✓ User rate overrides backfilled from existing user records");

    // Backfill completed_date for existing completed tasks
    try {
      const [updated] = await connection.query(
        `UPDATE tasks 
         SET completed_date = updated_at 
         WHERE status IN ('completed', 'approved', 'rejected') 
         AND completed_date IS NULL`
      );
      if (updated.affectedRows > 0) {
        console.log(`✓ Backfilled completed_date for ${updated.affectedRows} existing tasks`);
      }
    } catch (err) {
      console.warn("Could not backfill completed_date:", err.message);
    }

    await connection.end();
    console.log("✓ Database initialization complete!");
  } catch (err) {
    console.error("✗ Database initialization failed:", err.message);
    if (connection) await connection.end();
    // Don't exit - let the server continue
  }
}

// Call init without blocking
console.log("🔵 Calling initDatabase...");
initDatabase()
  .then(() => {
    console.log("✓ initDatabase completed successfully");
  })
  .catch(err => {
    console.error("✗ Database init error:", err);
  });
