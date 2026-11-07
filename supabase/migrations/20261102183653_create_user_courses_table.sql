/*
# Save each student's selected courses and exams

1. New Tables
- `user_courses`: one row per course or exam a student selects.
  - `id` (uuid, primary key)
  - `user_id` (uuid, defaults to the signed-in user, references auth.users)
  - `category` (text, the department group such as Engineering or NEET)
  - `course_name` (text, the course or exam name)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `user_courses`.
- Grant SELECT, INSERT, DELETE to `authenticated` only.
- Each signed-in user can read, add and remove only their own rows.

3. Important Notes
- A student cannot save the same course twice (unique per user and course name).
*/

CREATE TABLE IF NOT EXISTS user_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  course_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_courses_unique_per_user UNIQUE (user_id, course_name)
);

CREATE INDEX IF NOT EXISTS user_courses_user_id_idx ON user_courses (user_id);

ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON user_courses TO authenticated;

DROP POLICY IF EXISTS "select_own_courses" ON user_courses;
CREATE POLICY "select_own_courses" ON user_courses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_courses" ON user_courses;
CREATE POLICY "insert_own_courses" ON user_courses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_courses" ON user_courses;
CREATE POLICY "delete_own_courses" ON user_courses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
