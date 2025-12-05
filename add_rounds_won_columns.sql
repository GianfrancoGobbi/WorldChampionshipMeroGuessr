ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS player1_rounds_won INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS player2_rounds_won INT DEFAULT 0;
