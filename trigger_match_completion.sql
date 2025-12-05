CREATE OR REPLACE FUNCTION trigger_match_completion(p_match_id uuid)
RETURNS void AS $$
BEGIN
    -- This function simply calls the main check_match_completion function.
    -- It acts as a dedicated, secure entry point from the client-side.
    PERFORM check_match_completion(p_match_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
