CREATE OR REPLACE FUNCTION check_match_completion(p_match_id uuid)
RETURNS void AS $$
DECLARE
    v_player1_id uuid;
    v_player2_id uuid;
    v_championship_id uuid;
    v_player1_guesses_count INT;
    v_player2_guesses_count INT;
    v_player1_rounds_won INT;
    v_player2_rounds_won INT;
BEGIN
    -- 1. Get match details and check if it's already completed.
    SELECT player1_id, player2_id, championship_id
    INTO v_player1_id, v_player2_id, v_championship_id
    FROM public.matches
    WHERE id = p_match_id AND status <> 'completed';

    IF NOT FOUND THEN
        RAISE NOTICE 'Match % not found or already completed.', p_match_id;
        RETURN;
    END IF;

    -- 2. Check if both players have completed all 6 rounds.
    SELECT COUNT(*) INTO v_player1_guesses_count FROM public.match_guesses WHERE match_id = p_match_id AND user_id = v_player1_id;
    SELECT COUNT(*) INTO v_player2_guesses_count FROM public.match_guesses WHERE match_id = p_match_id AND user_id = v_player2_id;

    IF v_player1_guesses_count < 6 OR v_player2_guesses_count < 6 THEN
        RAISE NOTICE 'Match % not yet completed by both players.', p_match_id;
        RETURN;
    END IF;

    -- 3. Reliably compare scores and determine rounds won.
    WITH scores AS (
        SELECT
            round_number,
            MAX(CASE WHEN user_id = v_player1_id THEN score ELSE -1 END) as player1_score,
            MAX(CASE WHEN user_id = v_player2_id THEN score ELSE -1 END) as player2_score
        FROM public.match_guesses
        WHERE match_id = p_match_id
        GROUP BY round_number
    )
    SELECT
        COUNT(CASE WHEN player1_score > player2_score THEN 1 END),
        COUNT(CASE WHEN player2_score > player1_score THEN 1 END)
    INTO v_player1_rounds_won, v_player2_rounds_won
    FROM scores;

    -- 4. Determine match outcome and update standings.
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

    RAISE NOTICE 'Match % has been completed and scores updated successfully.', p_match_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
