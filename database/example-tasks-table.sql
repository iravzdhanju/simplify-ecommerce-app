-- Example Tasks Table for Native Clerk + Supabase Integration
-- This is a simple example to test the native integration

-- Create a tasks table with automatic user_id assignment
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT (auth.jwt() ->> 'sub'),
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the tasks table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies using the native integration
-- Users can only see their own tasks
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- Users can insert tasks (user_id is set automatically)
CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Users can update their own tasks
CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Users can delete their own tasks
CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- Optional: Create an updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at 
  BEFORE UPDATE ON tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Test the setup (run these after setting up Clerk integration):
-- INSERT INTO tasks (name) VALUES ('Test task 1');
-- INSERT INTO tasks (name) VALUES ('Test task 2');
-- SELECT * FROM tasks; -- Should only show tasks for the authenticated user 