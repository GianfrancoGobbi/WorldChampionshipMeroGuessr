CREATE OR REPLACE FUNCTION get_or_create_match_round(p_match_id uuid, p_round_number int, p_lat double precision, p_lng double precision)
RETURNS TABLE(lat double precision, lng double precision) AS $$
DECLARE
    v_existing_lat double precision;
    v_existing_lng double precision;
    is_player boolean;
BEGIN
    -- Security Check: Ensure the caller is a player in the match.
    SELECT EXISTS (
        SELECT 1
        FROM public.matches
        WHERE id = p_match_id AND (player1_id = auth.uid() OR player2_id = auth.uid())
    ) INTO is_player;

    IF NOT is_player THEN
        RAISE EXCEPTION 'User is not a participant in this match.';
    END IF;

    -- Check if a location for the current round already exists.
    SELECT mr.lat, mr.lng
    INTO v_existing_lat, v_existing_lng
    FROM public.match_rounds mr
    WHERE mr.match_id = p_match_id AND mr.round_number = p_round_number;

    -- If location exists, return it.
    IF FOUND THEN
        RETURN QUERY SELECT v_existing_lat, v_existing_lng;
        RETURN;
    END IF;

    -- If no location exists, insert the new one and return it.
    INSERT INTO public.match_rounds(match_id, round_number, lat, lng)
    VALUES (p_match_id, p_round_number, p_lat, p_lng);

    RETURN QUERY SELECT p_lat, p_lng;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
