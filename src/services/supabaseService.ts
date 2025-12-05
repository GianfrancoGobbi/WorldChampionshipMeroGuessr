import { supabase } from '../../supabaseClient';
import { googleMapsService } from './googleMapsService';
import type { Ranking, RankingPeriod, Location, PlayerGuess, PlayedRound } from '../types';
import type { User } from "@supabase/supabase-js";

export const getOrGenerateCurrentRoundLocation = async (roundNumber: number): Promise<Location> => {
    // The game day is based on Argentina time (ART / UTC-3).
    // We adjust the current date to get the correct "day" for storing locations.
    const now = new Date();
    const gameDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = gameDate.toISOString().split('T')[0];
    
    // 1. Try to get existing locations for today
    let { data, error } = await supabase
        .from('daily_locations')
        .select('locations')
        .eq('location_date', today)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
         throw new Error("Could not fetch daily locations.");
    }

    let existingLocations = (data?.locations as Location[]) || [];

    // 2. If we have a location for this round, return it
    if (existingLocations.length >= roundNumber) {
        return existingLocations[roundNumber - 1];
    }

    // 3. If not, generate a new one
    const newLocation = await googleMapsService.getRandomLocation();
    
    // 4. CRITICAL: Fetch again to ensure we don't overwrite if someone else just saved
    const { data: refreshData, error: refreshError } = await supabase
        .from('daily_locations')
        .select('locations')
        .eq('location_date', today)
        .single();

    if (!refreshError && refreshData) {
        const refreshedLocations = (refreshData.locations as Location[]) || [];
        if (refreshedLocations.length >= roundNumber) {
             // Someone beat us to it, return their location
            return refreshedLocations[roundNumber - 1];
        }
        existingLocations = refreshedLocations;
    }

    // 5. Append the new location and save
    const updatedLocations = [...existingLocations, newLocation];

    const { error: upsertError } = await supabase
        .from('daily_locations')
        .upsert({ location_date: today, locations: updatedLocations }, { onConflict: 'location_date' });
    
    if (upsertError) {
        // If write failed, try one last read
        let { data: finalData } = await supabase
            .from('daily_locations')
            .select('locations')
            .eq('location_date', today)
            .single();
        
        const finalLocations = (finalData?.locations as Location[]) || [];
        if (finalLocations.length >= roundNumber) {
            return finalLocations[roundNumber - 1];
        }
        throw new Error("Could not save daily location.");
    }
    
    return newLocation;
};


export const fetchRoundsPlayedToday = async (user: User): Promise<number> => {
    const now = new Date();
    // The game day is based on Argentina time (ART / UTC-3), which resets at 03:00 UTC.
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(3, 0, 0, 0);

    if (now.getTime() < startOfDay.getTime()) {
        startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
    }

    const { count, error } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString());

    if (error) {
        console.error("Error fetching rounds played:", error);
        throw new Error("Could not check your daily rounds.");
    }
    
    return count ?? 0;
};

export const fetchPlayedRoundsToday = async (user: User): Promise<PlayedRound[]> => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(3, 0, 0, 0);

    if (now.getTime() < startOfDay.getTime()) {
        startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
    }

    const { data, error } = await supabase
        .from('scores')
        .select('score, location, guessed_location') // Select columns needed for PlayedRound
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: true });

    if (error) {
         console.error("Error fetching played rounds:", error);
         return [];
    }
    
    // Map to PlayedRound interface. Note: 'location' and 'guessed_location' are jsonb in DB, but TS treats them as any or specific type if casted.
    return (data || []).map(item => ({
        location: item.location,
        guessed_location: item.guessed_location
    })) as PlayedRound[];
}

export const saveScore = async (
    user: User, 
    scoreToSave: number, 
    distanceToSave: number, 
    guessedLocation: Location | null, 
    realLocation: Location | null
): Promise<void> => {
    // We need to save the locations to enable the detail view later
    const { error } = await supabase.from('scores').insert({
        user_id: user.id,
        score: scoreToSave,
        distance_km: distanceToSave,
        guessed_location: guessedLocation,
        location: realLocation
    });
    if (error) {
        console.error("Error saving score:", error);
        throw new Error("Could not save your score.");
    }
};

export const fetchGuessesForLocation = async (location: Location, currentUserId: string): Promise<PlayerGuess[]> => {
    // We need to find scores that match this location (fuzzy match or exact)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(3, 0, 0, 0); // Approx daily start

    if (now.getTime() < startOfDay.getTime()) {
        startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
    }
    
    // 1. Fetch scores for today first (without joining profiles to avoid FK errors)
    const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('user_id, guessed_location, location')
        .gte('created_at', startOfDay.toISOString())
        .neq('user_id', currentUserId); // Exclude current user

    if (scoresError) {
        console.error("Error fetching scores for guesses:", scoresError);
        throw new Error("Could not fetch other guesses.");
    }
    
    if (!scoresData || scoresData.length === 0) return [];

    // 2. Filter by location (fuzzy match) in Javascript
    const tolerance = 0.005; // Approx 500m-1km depending on latitude
    
    const relevantScores = scoresData.filter((item: any) => {
        const loc = item.location as Location;
        if (!loc || !loc.lat || !loc.lng) return false;
        // Check if this score belongs to the same round location
        return Math.abs(loc.lat - location.lat) < tolerance && Math.abs(loc.lng - location.lng) < tolerance;
    });

    if (relevantScores.length === 0) return [];

    // 3. Fetch profiles for the relevant user_ids
    const userIds = [...new Set(relevantScores.map((s: any) => s.user_id))];
    
    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

    if (profilesError) {
        console.error("Error fetching profiles for guesses:", profilesError);
        // Proceed with unknown names rather than failing completely
    }

    // Create a map of user_id -> username
    const profilesMap = new Map<string, string>();
    if (profilesData) {
        profilesData.forEach((p: any) => {
            profilesMap.set(p.id, p.username);
        });
    }

    // 4. Merge data
    return relevantScores.map((item: any) => ({
        guessed_location: item.guessed_location,
        profiles: {
            username: profilesMap.get(item.user_id) || 'Unknown'
        }
    }));
};

export const fetchRankings = async (selectedPeriod: RankingPeriod): Promise<Ranking[]> => {
    const now = new Date();
    let fromDate: Date | null = new Date();

    switch (selectedPeriod) {
        case 'daily':
            const startOfDay = new Date(now);
            startOfDay.setUTCHours(3, 0, 0, 0);
            if (now.getTime() < startOfDay.getTime()) {
                startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
            }
            fromDate = startOfDay;
            break;
        case 'weekly':
            fromDate.setUTCDate(now.getUTCDate() - 7);
            break;
        case 'monthly':
            fromDate.setUTCMonth(now.getUTCMonth() - 1);
            break;
        case 'all-time':
        case 'average': // fetch all data for average calculation
            fromDate = null;
            break;
    }

    let scoresQuery = supabase
        .from('scores')
        .select('user_id, score');

    if (fromDate) {
        scoresQuery = scoresQuery.gte('created_at', fromDate.toISOString());
    }

    const { data: scoresData, error: scoresError } = await scoresQuery;

    if (scoresError) {
        console.error("Error fetching scores:", scoresError);
        throw new Error("Could not load scores.");
    }
    if (!scoresData || scoresData.length === 0) return [];

    const userScores = new Map<string, { totalScore: number, count: number }>();
    scoresData.forEach(item => {
        if (!item.user_id) return;
        const current = userScores.get(item.user_id) || { totalScore: 0, count: 0 };
        current.totalScore += Number(item.score);
        current.count += 1;
        userScores.set(item.user_id, current);
    });

    let aggregatedScores = Array.from(userScores.entries()).map(([userId, data]) => {
        const score = selectedPeriod === 'average' 
            ? (data.count > 0 ? data.totalScore / data.count : 0)
            : data.totalScore;
        
        return {
            score: score,
            user_id: userId,
            count: data.count
        };
    });

    // Filter for average: must have at least 50 rounds played
    if (selectedPeriod === 'average') {
        aggregatedScores = aggregatedScores.filter(item => item.count >= 50);
    }

    aggregatedScores.sort((a, b) => b.score - a.score);

    if (aggregatedScores.length === 0) return [];

    const userIds = aggregatedScores.map(score => score.user_id);
    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

    if (profilesError) throw new Error("Could not load usernames for rankings.");

    const profilesMap = new Map<string, string | null>();
    profilesData?.forEach(profile => {
        profilesMap.set(profile.id, profile.username);
    });

    return aggregatedScores.map(score => ({
        score: score.score,
        user_id: score.user_id,
        created_at: '', 
        profiles: {
            username: profilesMap.get(score.user_id) || 'Unknown'
        }
    }));
};