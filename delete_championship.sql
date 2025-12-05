CREATE OR REPLACE FUNCTION public.delete_championship(p_championship_id uuid)
RETURNS void AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if the calling user is the admin
  SELECT (auth.jwt()->>'email' = 'ggobbi@merovingiandata.com') INTO is_admin;

  IF is_admin THEN
    -- Delete related match guesses first
    DELETE FROM public.match_guesses
    WHERE match_id IN (SELECT id FROM public.matches WHERE championship_id = p_championship_id);

    -- Delete related match rounds
    DELETE FROM public.match_rounds
    WHERE match_id IN (SELECT id FROM public.matches WHERE championship_id = p_championship_id);

    -- Delete matches for the championship
    DELETE FROM public.matches
    WHERE championship_id = p_championship_id;

    -- Delete participants of the championship
    DELETE FROM public.championship_participants
    WHERE championship_id = p_championship_id;

    -- Finally, delete the championship itself
    DELETE FROM public.championships
    WHERE id = p_championship_id;

    RAISE NOTICE 'Championship % and all related data have been deleted.', p_championship_id;
  ELSE
    RAISE EXCEPTION 'You do not have permission to delete championships.';
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
