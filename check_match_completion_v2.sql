CREATE OR REPLACE FUNCTION check_match_completion(p_match_id uuid)
RETURNS void AS $$
DECLARE
    v_player1_id uuid;
    v_player2_id uuid;
    v_championship_id uuid;
    v_player1_guesses_count INT;
    v_player2_guesses_count INT;
    v_player1_rounds_won INT := 0;
    v_player2_rounds_won INT := 0;
BEGIN
    -- 1. Get match details
    SELECT player1_id, player2_id, championship_id
    INTO v_player1_id, v_player2_id, v_championship_id
    FROM public.matches
    WHERE id = p_match_id AND status <> 'completed';

    IF NOT FOUND THEN RETURN; END IF;

    -- 2. Check if both players have completed all 6 rounds
    SELECT COUNT(*) INTO v_player1_guesses_count FROM public.match_guesses WHERE match_id = p_match_id AND user_id = v_player1_id;
    SELECT COUNT(*) INTO v_player2_guesses_count FROM public.match_guesses WHERE match_id = p_match_id AND user_id = v_player2_id;

    IF v_player1_guesses_count < 6 OR v_player2_guesses_count < 6 THEN RETURN; END IF;

    -- 3. Compare scores and determine rounds won in a single query
    WITH player1_scores AS (
        SELECT round_number, score FROM public.match_guesses WHERE match_id = p_match_id AND user_id = v_player1_id
    ),
    player2_scores AS (
        SELECT round_number, score FROM public.match_guesses WHERE match_id = p_match_id AND user_id = v_player2_id
    )
    SELECT 
        COUNT(CASE WHEN p1.score > p2.score THEN 1 END),
        COUNT(CASE WHEN p2.score > p1.score THEN 1 END)
    INTO v_player1_rounds_won, v_player2_rounds_won
    FROM player1_scores p1
    JOIN player2_scores p2 ON p1.round_number = p2.round_number;

    -- 4. Determine match outcome and update standings
    IF v_player1_rounds_won > v_player2_rounds_won THEN
        UPDATE public.matches SET status = 'completed', winner_id = v_player1_id, loser_id = v_player2_id, player1_rounds_won = v_player1_rounds_won, player2_rounds_won = v_player2_rounds_won WHERE id = p_match_id;
        UPDATE public.championship_participants SET points = points + 3, wins = wins + 1, matches_played = matches_played + 1 WHERE championship_id = v_championship_id AND user_id = v_player1_id;
        UPDATE public.championship_participants SET losses = losses + 1, matches_played = matches_played + 1 WHERE championship_id = v_championship_id AND user_id = v_player2_id;
    ELSIF v_player2_rounds_won > v_player1_rounds_won THEN
        UPDATE public.matches SET status = 'completed', winner_id = v_player2_id, loser_id = v_player1_id, player1_rounds_won = v_player1_rounds_won, player2_rounds_won = v_player2_rounds_won WHERE id = p_match_id;
        UPDATE public.championship_participants SET points = points + 3, wins = wins + 1, matches_played = matches_played + 1 WHERE championship_id = v_championship_id AND user_id = v_player2_id;
        UPDATE public.championship_participants SET losses = losses + 1, matches_played = matches_played + 1 WHERE championship_id = v_championship_id AND user_id = v_player1_id;
    ELSE
        UPDATE public.matches SET status = 'completed', player1_rounds_won = v_player1_rounds_won, player2_rounds_won = v_player2_rounds_won WHERE id = p_match_id;
        UPDATE public.championship_participants SET points = points + 1, draws = draws + 1, matches_played = matches_played + 1 WHERE championship_id = v_championship_id AND (user_id = v_player1_id OR user_id = v_player2_id);
    END IF;
END;
$$ LANGUAGE plpgsql;
