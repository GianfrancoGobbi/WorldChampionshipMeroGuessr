import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import AuthForm from './AuthForm';
import MeroGuessr from './MeroGuessr';
import Championships from './Championships';
import HamburgerMenu from './HamburgerMenu';
import RankingsModal from './RankingsModal';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const [view, setView] = useState<'game' | 'championships'>('championships');
    const [matchIdToPlay, setMatchIdToPlay] = useState<string | null>(null);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRankingsOpen, setIsRankingsOpen] = useState(false);

    useEffect(() => {
        const fetchSessionAndPendingMatch = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Error getting session:', error);
                setLoading(false);
                return;
            }

            if (session) {
                setSession(session);

                // Check for pending matches
                const { data, error: matchError } = await supabase
                    .from('matches')
                    .select('id')
                    .or(`player1_id.eq.${session.user.id},player2_id.eq.${session.user.id}`)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: true })
                    .limit(1);

                if (matchError) {
                    console.error('Error fetching pending match:', matchError);
                }

                if (data && data.length > 0) {
                    setMatchIdToPlay(data[0].id);
                    setView('game');
                } else {
                    setView('championships');
                }
            } else {
                setSession(null);
            }
            setLoading(false);
        };

        fetchSessionAndPendingMatch();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
            if (!newSession) {
                setView('championships');
                setMatchIdToPlay(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsMenuOpen(false);
    };

    if (!isSupabaseConfigured) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-6 rounded-lg max-w-md shadow-lg">
                    <p className="font-bold text-lg mb-2">Supabase Configuration Missing</p>
                    <p>Please configure your Supabase project credentials in the <code className="bg-yellow-200 text-yellow-800 px-1 rounded">supabaseClient.ts</code> file to enable authentication and data features.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="w-screen h-screen bg-gray-900 flex items-center justify-center">
                <div className="border-8 border-gray-200 border-t-blue-600 rounded-full w-16 h-16 animate-spin"></div>
            </div>
        );
    }

    if (!session) return <AuthForm />;

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            <HamburgerMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                onOpenRankings={() => { setIsMenuOpen(false); setIsRankingsOpen(true); }}
                onOpenChampionships={() => { setIsMenuOpen(false); setView('championships'); }}
                onSignOut={handleSignOut}
                session={session}
            />
            <RankingsModal isOpen={isRankingsOpen} onClose={() => setIsRankingsOpen(false)} user={session.user} />

            <button
                onClick={() => setIsMenuOpen(true)}
                className="fixed top-4 left-4 z-50 p-2 rounded-full bg-gray-900 bg-opacity-40 hover:bg-opacity-60 transition-colors text-white"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {view === 'championships' ? (
                <Championships
                    session={session}
                    onBack={() => setView('game')}
                    onPlayMatch={(matchId) => {
                        setMatchIdToPlay(matchId);
                        setView('game');
                    }}
                />
            ) : (
                <MeroGuessr
                    session={session}
                    onOpenChampionships={() => setView('championships')}
                    matchId={matchIdToPlay}
                    onMatchExit={() => {
                        setMatchIdToPlay(null);
                        setView('championships');
                    }}
                />
            )}
        </div>
    );
};

export default App;
