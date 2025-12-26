import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import AuthForm from './AuthForm';
import MeroGuessr from './MeroGuessr';
import Championships from './Championships';
import CustomModes from './CustomModes';
import HamburgerMenu from './HamburgerMenu';
import RankingsModal from './RankingsModal';

const AppContent: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRankingsOpen, setIsRankingsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Error getting session:', error);
                setLoading(false);
                return;
            }

            if (session) {
                setSession(session);
            } else {
                setSession(null);
            }

            setLoading(false);
        };

        fetchSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsMenuOpen(false);
        navigate('/');
    };

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
                onOpenChampionships={() => { setIsMenuOpen(false); navigate('/championships'); }}
                onOpenCustomModes={() => { setIsMenuOpen(false); navigate('/custom-modes'); }}
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

            <Routes>
                <Route path="/championships" element={<Championships session={session} />} />
                <Route path="/championships/:id" element={<Championships session={session} />} />
                <Route path="/custom-modes" element={<CustomModes session={session} />} />
                <Route path="/custom-modes/:id" element={<CustomModes session={session} />} />
                <Route path="/test/:modeId" element={<MeroGuessr session={session} onOpenChampionships={() => navigate('/championships')} onMatchExit={() => navigate('/championships')} />} />
                <Route path="/game" element={<MeroGuessr session={session} onOpenChampionships={() => navigate('/championships')} onMatchExit={() => navigate('/championships')} />} />
                <Route path="/game/:matchId" element={<MeroGuessr session={session} onOpenChampionships={() => navigate('/championships')} onMatchExit={() => navigate('/championships')} />} />
                <Route path="*" element={<Navigate to="/championships" replace />} />
            </Routes>
        </div>
    );
};

const App: React.FC = () => {
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

    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
};

export default App;
