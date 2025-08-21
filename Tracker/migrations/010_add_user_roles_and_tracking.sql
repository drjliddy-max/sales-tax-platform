-- Migration: Add user roles and login tracking
-- Date: 2024-01-19
-- Description: Add role field and login tracking to users table for admin/client separation

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'CLIENT' CHECK (role IN ('CLIENT', 'ADMIN'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Set John Liddy as admin user if exists
UPDATE users 
SET role = 'ADMIN' 
WHERE email IN ('john@johnliddy.com', 'admin@sales-tax-tracker.com', 'johnliddy@gmail.com')
  AND role != 'ADMIN';

-- Insert a default admin user for testing (if not exists)
INSERT INTO users (clerk_user_id, email, first_name, last_name, role, is_active, created_at, updated_at)
SELECT 'admin_test_user', 'admin@sales-tax-tracker.com', 'Admin', 'User', 'ADMIN', true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@sales-tax-tracker.com'
);

-- Update existing users to be active by default
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- Add comment to role column
COMMENT ON COLUMN users.role IS 'User role: CLIENT (business owner) or ADMIN (system administrator)';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active and can log in';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the users last successful login';

-- Log the migration
INSERT INTO audit_logs (action, entity_type, entity_id, new_values, timestamp)
VALUES (
  'DATABASE_MIGRATION',
  'SYSTEM',
  'migration_010',
  '{"migration": "add_user_roles_and_tracking", "description": "Added role, is_active, and last_login_at fields to users table"}',
  NOW()
);
