# Database Migration Instructions

## Execute the SQL migration to add new features

Run the following SQL file against your MySQL database:

```bash
mysql -u root -p plastritrack < server/db/add_missing_features.sql
```

Or manually execute the SQL commands in your MySQL client:

1. Open MySQL Workbench or your preferred MySQL client
2. Connect to your database
3. Open the file: `server/db/add_missing_features.sql`
4. Execute all the SQL commands

## What the migration adds:

1. **`is_active` column** to `users` table
   - Allows enabling/disabling user accounts
   - Default value: TRUE (all existing users remain active)

2. **`work_hours` table**
   - Tracks admin working hours for payment calculation
   - Fields: admin_id, date, hours_worked, task_description, status, approved_by
   - Status: pending, approved, rejected

3. **`hourly_rate` column** to `users` table
   - Stores hourly rate for admin payment calculation
   - Default: 1000.00 for existing admins

## Verify Migration

After running the migration, verify with these queries:

```sql
-- Check is_active column
DESCRIBE users;

-- Check work_hours table
DESCRIBE work_hours;

-- Check hourly_rate column
SELECT id, name, role, hourly_rate, is_active FROM users WHERE role = 'admin';
```

## Restart Your Server

After running the migration, restart your Node.js server:

```bash
cd server
npm start
```
