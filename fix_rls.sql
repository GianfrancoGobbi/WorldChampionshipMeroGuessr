-- Run this in your Supabase SQL Editor to fix the visibility issues.

-- 1. Enable RLS (if not already enabled)
ALTER TABLE match_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_guesses ENABLE ROW LEVEL SECURITY;

-- 2. Create policies to allow ALL authenticated users to view match data
-- We use "IF NOT EXISTS" logic by checking pg_policies, or we can just try to create them.
-- Since we can't easily script complex logic in the simple editor sometimes, here are simple statements.
-- If they fail saying "policy already exists", that's fine, it means you might need to drop the old strictly scoped one.

-- Allow viewing rounds
CREATE POLICY "Enable read access for all users" ON match_rounds
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow viewing guesses
CREATE POLICY "Enable read access for all users" ON match_guesses
    FOR SELECT
    TO authenticated
    USING (true);

-- CRITICAL: Allow INSERTING guesses (fixes the "score not saving" issue)
CREATE POLICY "Enable insert for authenticated users" ON match_guesses
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Daily/Training Scores
CREATE POLICY "Enable insert for daily scores" ON scores
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable read daily scores" ON scores
    FOR SELECT
    TO authenticated
    USING (true);
