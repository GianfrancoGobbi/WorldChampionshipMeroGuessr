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
    v_round_number INT;
    v_player1_score NUMERIC;
    v_player2_score NUMERIC;
BEGIN
    -- 1. Get match details and ensure it's not already completed
    SELECT player1_id, player2_id, championship_id
    INTO v_player1_id, v_player2_id, v_championship_id
    FROM public.matches
    WHERE id = p_match_id AND status <> 'completed';

    -- If match not found or already completed, exit
    IF NOT FOUND THEN
        RAISE NOTICE 'Match not found or already completed: %', p_match_id;
        RETURN;
    END IF;

    -- 2. Check if both players have completed all 6 rounds
    SELECT COUNT(*)
    INTO v_player1_guesses_count
    FROM public.match_guesses
    WHERE match_id = p_match_id AND user_id = v_player1_id;

    SELECT COUNT(*)
    INTO v_player2_guesses_count
    FROM public.match_guesses
    WHERE match_id = p_match_id AND user_id = v_player2_id;

    -- If not all rounds are played by both, exit
    IF v_player1_guesses_count < 6 OR v_player2_guesses_count < 6 THEN
        RAISE NOTICE 'Match % not yet completed by both players.', p_match_id;
        RETURN;
    END IF;

    -- 3. Compare scores for each of the 6 rounds
    FOR v_round_number IN 1..6 LOOP
        -- Get player 1's score for the round
        SELECT score INTO v_player1_score
        FROM public.match_guesses
        WHERE match_id = p_match_id AND user_id = v_player1_id AND round_number = v_round_number;

        -- Get player 2's score for the round
        SELECT score INTO v_player2_score
        FROM public.match_guesses
        WHERE match_id = p_match_id AND user_id = v_player2_id AND round_number = v_round_number;

        -- Compare scores and assign round win
        IF v_player1_score > v_player2_score THEN
            v_player1_rounds_won := v_player1_rounds_won + 1;
        ELSIF v_player2_score > v_player1_score THEN
            v_player2_rounds_won := v_player2_rounds_won + 1;
        END IF;
        -- If scores are equal, it's a draw for the round, no points awarded for the round win count
    END LOOP;

    -- 4. Determine match outcome and update standings
    IF v_player1_rounds_won > v_player2_rounds_won THEN
        -- Player 1 wins
        UPDATE public.matches
        SET status = 'completed', winner_id = v_player1_id, loser_id = v_player2_id
        WHERE id = p_match_id;

        UPDATE public.championship_participants
        SET points = points + 3, wins = wins + 1, matches_played = matches_played + 1
        WHERE championship_id = v_championship_id AND user_id = v_player1_id;

        UPDATE public.championship_participants
        SET losses = losses + 1, matches_played = matches_played + 1
        WHERE championship_id = v_championship_id AND user_id = v_player2_id;

    ELSIF v_player2_rounds_won > v_player1_rounds_won THEN
        -- Player 2 wins
        UPDATE public.matches
        SET status = 'completed', winner_id = v_player2_id, loser_id = v_player1_id
        WHERE id = p_match_id;

        UPDATE public.championship_participants
        SET points = points + 3, wins = wins + 1, matches_played = matches_played + 1
        WHERE championship_id = v_championship_id AND user_id = v_player2_id;

        UPDATE public.championship_participants
        SET losses = losses + 1, matches_played = matches_played + 1
        WHERE championship_id = v_championship_id AND user_id = v_player1_id;

    ELSE
        -- It's a draw
        UPDATE public.matches
        SET status = 'completed'
        WHERE id = p_match_id;

        UPDATE public.championship_participants
        SET points = points + 1, draws = draws + 1, matches_played = matches_played + 1
        WHERE championship_id = v_championship_id AND (user_id = v_player1_id OR user_id = v_player2_id);
    END IF;

    RAISE NOTICE 'Match % has been completed and scores have been updated.', p_match_id;

END;
$$ LANGUAGE plpgsql;
