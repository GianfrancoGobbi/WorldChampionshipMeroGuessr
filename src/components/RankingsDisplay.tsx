import React, { useState, useEffect, useCallback } from 'react';
import type { User } from "@supabase/supabase-js";
import { fetchRankings, fetchPlayedRoundsToday } from '../services/supabaseService';
import type { Ranking, RankingPeriod, PlayedRound } from '../types';
import LocationDetailModal from './LocationDetailModal';

interface RankingsDisplayProps {
    user: User | null;
}

const RankingsDisplay: React.FC<RankingsDisplayProps> = ({ user }) => {
    const [period, setPeriod] = useState<RankingPeriod>('daily');
    const [rankings, setRankings] = useState<Ranking[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [activeTab, setActiveTab] = useState<'rankings' | 'locations'>('rankings');
    const [playedRounds, setPlayedRounds] = useState<PlayedRound[]>([]);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [locationsError, setLocationsError] = useState<string | null>(null);
    const [selectedRound, setSelectedRound] = useState<PlayedRound | null>(null);

    const loadRankings = useCallback(async (selectedPeriod: RankingPeriod) => {
        setLoading(true);
        setError(null);
        setRankings([]);
        try {
            const data = await fetchRankings(selectedPeriod);
            setRankings(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadPlayedRounds = useCallback(async () => {
        if (!user) return;
        setLocationsLoading(true);
        setLocationsError(null);
        setPlayedRounds([]);
        try {
            const data = await fetchPlayedRoundsToday(user);
            setPlayedRounds(data);
        } catch (e: any) {
            setLocationsError(e.message);
        } finally {
            setLocationsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'rankings') {
            loadRankings(period);
        } else {
            loadPlayedRounds();
        }
    }, [period, activeTab, loadRankings, loadPlayedRounds]);
    
    const periodLabels: { [key in RankingPeriod]: string } = {
        'daily': 'Daily',
        'weekly': 'Weekly',
        'monthly': 'Monthly',
        'all-time': 'All-Time',
        'average': 'Average',
    };

     const handleRoundClick = (round: PlayedRound) => {
        setSelectedRound(round);
    };

    const renderRankings = () => (
         <>
            <div className="flex justify-center border-b border-gray-600 mb-4 flex-wrap">
                {(Object.keys(periodLabels) as RankingPeriod[]).map(p => (
                    <button 
                        key={p} 
                        onClick={() => setPeriod(p)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${period === p ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        {periodLabels[p]}
                    </button>
                ))}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {loading && <div className="text-center p-4">Loading...</div>}
                {error && <div className="text-center p-4 text-red-400">{error}</div>}
                {!loading && !error && rankings.length === 0 && <div className="text-center p-4 text-gray-500">No scores yet for this period.</div>}
                {rankings.map((r, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-center">
                            <span className={`font-bold text-gray-400 w-10 text-center ${index < 3 ? 'text-2xl' : 'text-lg'}`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </span>
                            <span className="font-semibold ml-2">{r.profiles?.username || 'Unknown'}</span>
                        </div>
                        <span className="font-bold text-blue-400">{r.score.toFixed(2)} pts</span>
                    </div>
                ))}
            </div>
        </>
    );

     const renderLocations = () => (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {locationsLoading && <div className="text-center p-4">Loading Locations...</div>}
            {locationsError && <div className="text-center p-4 text-red-400">{locationsError}</div>}
            {!locationsLoading && !locationsError && playedRounds.length === 0 && <div className="text-center p-4 text-gray-500">Play a round to see its location here.</div>}
            {playedRounds.map((round, index) => (
                <button 
                    key={index} 
                    onClick={() => handleRoundClick(round)}
                    className="w-full flex items-center justify-between bg-gray-700 p-3 rounded-lg text-left hover:bg-gray-600 transition-colors"
                >
                    <span className="font-semibold text-lg">Ronda {index + 1}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                </button>
            ))}
        </div>
    );

    return (
        <>
            <div className="bg-gray-800 text-white p-6 rounded-xl shadow-2xl w-full max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-center mb-4">Resumen Diario</h2>
                <div className="flex border-b border-gray-600 mb-4">
                     <button 
                        onClick={() => setActiveTab('rankings')}
                        className={`px-4 py-2 text-base font-medium transition-colors ${activeTab === 'rankings' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        Top Players
                    </button>
                    <button 
                        onClick={() => setActiveTab('locations')}
                        className={`px-4 py-2 text-base font-medium transition-colors ${activeTab === 'locations' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        Ubicaciones
                    </button>
                </div>
                 {activeTab === 'rankings' ? renderRankings() : renderLocations()}
            </div>
            {user && selectedRound && (
                 <LocationDetailModal 
                    isOpen={!!selectedRound}
                    onClose={() => setSelectedRound(null)}
                    roundData={selectedRound}
                    user={user}
                />
            )}
        </>
    );
}

export default RankingsDisplay;