const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'plastitrack'
    });

    console.log('=== DATABASE DATA ANALYSIS ===\n');
    
    // Count users
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log('Total Users:', users[0].count);

    // Count by role
    const [usersByRole] = await connection.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    console.log('\nUsers by role:');
    usersByRole.forEach(row => console.log(`  - ${row.role}: ${row.count}`));

    // Count payments
    const [payments] = await connection.query('SELECT COUNT(*) as count FROM payments');
    console.log('\nTotal Payments:', payments[0].count);

    // Count payments by status
    const [paymentsByStatus] = await connection.query('SELECT status, COUNT(*) as count FROM payments GROUP BY status');
    console.log('Payments by status:');
    if (paymentsByStatus.length > 0) {
      paymentsByStatus.forEach(row => console.log(`  - ${row.status}: ${row.count}`));
    } else {
      console.log('  No payments found');
    }

    // Count images
    const [images] = await connection.query('SELECT COUNT(*) as count FROM images');
    console.log('\nTotal Images:', images[0].count);

    // Count images by status
    const [imagesByStatus] = await connection.query('SELECT status, COUNT(*) as count FROM images GROUP BY status');
    if (imagesByStatus.length > 0) {
      console.log('Images by status:');
      imagesByStatus.forEach(row => console.log(`  - ${row.status}: ${row.count}`));
    }

    // Count tasks
    const [tasks] = await connection.query('SELECT COUNT(*) as count FROM tasks');
    console.log('\nTotal Tasks:', tasks[0].count);

    // Count tasks by type
    const [tasksByType] = await connection.query('SELECT task_type, COUNT(*) as count FROM tasks GROUP BY task_type');
    if (tasksByType.length > 0) {
      console.log('Tasks by type:');
      tasksByType.forEach(row => console.log(`  - ${row.task_type}: ${row.count}`));
    }

    // Count tasks by status
    const [tasksByStatus] = await connection.query('SELECT status, COUNT(*) as count FROM tasks GROUP BY status');
    if (tasksByStatus.length > 0) {
      console.log('Tasks by status:');
      tasksByStatus.forEach(row => console.log(`  - ${row.status}: ${row.count}`));
    }

    // Show sample payments
    console.log('\nSample Payment Records:');
    const [samplePayments] = await connection.query('SELECT id, user_id, amount, status, created_at, approved_by FROM payments LIMIT 3');
    if (samplePayments.length > 0) {
      samplePayments.forEach(row => {
        console.log(`  - ID: ${row.id}, User: ${row.user_id}, Amount: $${row.amount}, Status: ${row.status}, Approved By: ${row.approved_by || 'NULL'}`);
      });
    } else {
      console.log('  No payments in database');
    }

    // Check payments table structure
    const [columns] = await connection.query('SHOW COLUMNS FROM payments');
    console.log('\nPayments Table Columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}, ${col.Null === 'YES' ? 'nullable' : 'not null'})`);
    });

    // Test query from payment report endpoint
    console.log('\n=== TESTING PAYMENT REPORT QUERY ===');
    const [testPayments] = await connection.execute(
      `SELECT 
        p.id,
        p.user_id,
        u.name as annotatorName,
        u.email as annotatorEmail,
        p.images_completed as completedTasks,
        p.amount,
        p.status,
        p.payment_date,
        p.approved_date,
        p.created_at,
        p.model_type,
        approver.name as approvedBy
       FROM payments p
       INNER JOIN users u ON p.user_id = u.id
       LEFT JOIN users approver ON p.approved_by = approver.id
       ORDER BY p.created_at DESC`,
      []
    );
    console.log('Payment Report Query Result Count:', testPayments.length);
    if (testPayments.length > 0) {
      console.log('Sample result:', testPayments[0]);
    }

    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('Database error:', err.message);
    process.exit(1);
  }
})();
