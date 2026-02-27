-- Migration: Add task_type column and 'declined' status to tasks table
USE work_monitoring_db;

-- Step 1: Add task_type column
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_type ENUM('daily', 'custom') DEFAULT 'daily' AFTER emp_no;

-- Step 2: Update status ENUM to include 'declined'
ALTER TABLE tasks
  MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'overdue', 'declined') DEFAULT 'pending';

-- Step 3: Set task_type for existing tasks (default to 'custom' since they had explicit dates)
UPDATE tasks SET task_type = 'custom' WHERE task_type IS NULL OR task_type = 'daily';

SELECT 'Migration completed: task_type and declined status added' as message;
