-- Insert sample work hours for testing
-- This assumes user with id=1 is an admin (tharuka@gmail.com)

-- Add some work hours entries with different statuses
INSERT INTO work_hours (admin_id, date, hours_worked, task_description, status, is_auto_tracked, created_at)
VALUES 
(1, '2026-01-24', 8.0, 'Reviewed and assigned 50 images to annotators, verified quality checks', 'approved', FALSE, '2026-01-24 09:00:00'),
(1, '2026-01-25', 7.5, 'Conducted team training session, resolved image assignment issues', 'approved', FALSE, '2026-01-25 09:30:00'),
(1, '2026-01-26', 10.0, 'Weekend overtime - processed urgent batch of images', 'pending', FALSE, '2026-01-26 10:00:00'),
(1, '2026-01-27', 6.0, 'Reviewed tester feedback, reassigned rejected images', 'pending', FALSE, '2026-01-27 09:15:00'),
(1, '2026-01-28', 8.5, 'Monthly report generation and payment processing', 'pending', FALSE, '2026-01-28 09:00:00');

-- Add auto-tracked session entry
INSERT INTO work_hours (admin_id, date, hours_worked, task_description, status, is_auto_tracked, session_start, session_end, created_at)
VALUES 
(1, '2026-01-23', 7.0, 'Regular work session - automatically tracked', 'approved', TRUE, '2026-01-23 09:00:00', '2026-01-23 16:00:00', '2026-01-23 16:00:00');

-- Insert sample admin sessions (login/logout tracking)
INSERT INTO admin_sessions (admin_id, login_time, logout_time, session_duration, is_processed, ip_address)
VALUES 
(1, '2026-01-23 09:00:00', '2026-01-23 16:00:00', 7.0, TRUE, '127.0.0.1'),
(1, '2026-01-24 09:00:00', '2026-01-24 17:00:00', 8.0, FALSE, '127.0.0.1'),
(1, '2026-01-28 09:00:00', NULL, NULL, FALSE, '127.0.0.1'); -- Current active session

-- Insert sample payment records
-- Assuming user_id 3 is annotator (thiyumiupasari2003@gmail.com)
-- Assuming user_id 4 is tester (nipunjayakody110@gmail.com)

INSERT INTO payments (user_id, amount, model_type, images_completed, status, payment_method, payment_date, created_at)
VALUES 
(3, 25000.00, 'YOLO', 50, 'paid', 'bank_transfer', '2026-01-15 10:00:00', '2026-01-10 09:00:00'),
(3, 30000.00, 'ResNet', 60, 'approved', 'bank_transfer', NULL, '2026-01-20 09:00:00'),
(3, 15000.00, 'MobileNet', 30, 'pending', NULL, NULL, '2026-01-25 09:00:00'),
(4, 20000.00, 'YOLO', 40, 'paid', 'mobile_money', '2026-01-18 10:00:00', '2026-01-12 09:00:00'),
(4, 18000.00, 'ResNet', 36, 'approved', NULL, NULL, '2026-01-22 09:00:00'),
(4, 12000.00, 'MobileNet', 24, 'pending', NULL, NULL, '2026-01-26 09:00:00');

-- Update approved work hours with super admin approval
-- Assuming user_id 2 is super_admin (dineshasanka@gmail.com)
UPDATE work_hours 
SET approved_by = 2 
WHERE status = 'approved';

SELECT 'Sample data inserted successfully!' as message;
