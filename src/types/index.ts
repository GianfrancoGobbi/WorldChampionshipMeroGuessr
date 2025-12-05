import type { Session, User } from "@supabase/supabase-js";

// A type for Google Maps LatLng object for better type safety.
export type GoogleLatLng = any;

export type GameState = 'home' | 'loading' | 'ready' | 'playing' | 'result' | 'error';
export type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time' | 'average';

export interface Ranking {
    score: number;
    user_id: string;
    created_at: string;
    profiles: {
        username: string;
    };
}

export interface ScoreBreakdown {
    distance: number;
    time: number;
}

export interface Location {
    lat: number;
    lng: number;
}

export interface PlayerGuess {
    guessed_location: Location;
    profiles: {
        username: string;
    };
}

export interface PlayedRound {
    location: Location;
    guessed_location: Location | null;
}

export interface Championship {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    status: 'active' | 'completed';
}

export interface Participant {
    id: string;
    championship_id: string;
    user_id: string;
    points: number;
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    email?: string;
}

export interface Match {
    id: string;
    championship_id: string;
    player1_id: string;
    player2_id: string;
    player1_score: number;
    player2_score: number;
    status: 'pending' | 'completed';
    round_number: number;
    created_at: string;
    player1_email?: string;
    player2_email?: string;
}