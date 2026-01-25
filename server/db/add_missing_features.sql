-- Add is_active column to users table for enable/disable functionality
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE COMMENT 'User account active status';

-- Add auto_track_hours column to track if admin wants automatic hour tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auto_track_hours BOOLEAN DEFAULT TRUE COMMENT 'Auto-track working hours for admins';

-- Create work_hours table for tracking admin working hours
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
) COMMENT 'Tracks admin working hours for payment calculation';

-- Create admin_sessions table to track login/logout for automatic hour calculation
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
) COMMENT 'Tracks admin login/logout sessions for automatic hour tracking';

-- Add hourly_rate column to users table for admin payment calculation
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Hourly rate for admin payments';

-- Update existing admin users to have default hourly rate (example: 1000 per hour)
UPDATE users SET hourly_rate = 1000.00 WHERE role = 'admin' AND hourly_rate = 0;

-- Enable auto-tracking for all existing admins
UPDATE users SET auto_track_hours = TRUE WHERE role = 'admin';
