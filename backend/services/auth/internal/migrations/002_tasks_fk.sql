-- Migration 002: Add FK constraint on assigned_tasks.admin_id
-- Makes admin_id nullable first (required for ON DELETE SET NULL),
-- then adds the foreign key. Existing NULLs are not affected.
-- Idempotent: safe to re-run if the constraint already exists.

ALTER TABLE assigned_tasks
    ALTER COLUMN admin_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_assigned_tasks_admin'
          AND table_name = 'assigned_tasks'
    ) THEN
        ALTER TABLE assigned_tasks
            ADD CONSTRAINT fk_assigned_tasks_admin
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END;
$$;
