import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Championship, Match, Participant } from '../types';
import MatchRecap from './MatchRecap';
import ChampionshipMetrics from './ChampionshipMetrics';

interface ChampionshipsProps {
    session: Session;
}

const Championships: React.FC<ChampionshipsProps> = ({ session }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
    const [championships, setChampionships] = useState<Championship[]>([]);
    const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
    const [newChampionshipName, setNewChampionshipName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [selectedRecapMatchId, setSelectedRecapMatchId] = useState<string | null>(null);
    const [showMetrics, setShowMetrics] = useState(false);
    const [gameModes, setGameModes] = useState<{ id: string; name: string }[]>([]);
    const [selectedGameModeId, setSelectedGameModeId] = useState<string | null>(null);
    const [selectedFixtureRound, setSelectedFixtureRound] = useState<number | null>(null);
    const [myMatchCounts, setMyMatchCounts] = useState<Record<string, number>>({});

    // Initial load
    useEffect(() => {
        checkAdmin();
        fetchChampionships();
        fetchGameModes();
    }, []);

    const fetchGameModes = async () => {
        const { data } = await supabase.from('game_modes').select('id, name');
        if (data) setGameModes(data);
    };

    // Effect to handle URL changes
    useEffect(() => {
        if (id) {
            const fetchAndSetChampionship = async () => {
                const { data, error } = await supabase
                    .from('championships')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (data) {
                    setSelectedChampionship(data);
                    setView('detail');
                    fetchChampionshipDetails(id);
                } else if (error) {
                    console.error('Error fetching championship', error);
                    navigate('/championships');
                }
            };
            fetchAndSetChampionship();
        } else if (view === 'detail') {
            setView('list');
            setSelectedChampionship(null);
        }
    }, [id]);

    const checkAdmin = () => {
        setIsAdmin(session.user.email === 'ggobbi@merovingiandata.com');
    };

    const fetchChampionships = async () => {
        const { data, error } = await supabase
            .from('championships')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setChampionships(data);
        if (error) console.error('Error fetching championships', error);
    };

    const fetchChampionshipDetails = async (id: string) => {
        const { data: pData } = await supabase
            .from('championship_participants')
            .select('*')
            .eq('championship_id', id);

        const { data: profiles } = await supabase.from('profiles').select('id, username');

        const { data: mData } = await supabase
            .from('matches')
            .select('*, player1_rounds_won, player2_rounds_won')
            .eq('championship_id', id)
            .order('round_number', { ascending: true });

        if (pData) {
            const mappedParticipants = pData.map(p => ({
                ...p,
                email: profiles?.find(u => u.id === p.user_id)?.username || 'Unknown User',
            }));
            setParticipants(mappedParticipants);
        }

        if (mData) {
            const mappedMatches = mData.map(m => ({
                ...m,
                player1_email: profiles?.find(u => u.id === m.player1_id)?.username || 'Unknown User',
                player2_email: profiles?.find(u => u.id === m.player2_id)?.username || 'Unknown User',
            }));
            setMatches(mappedMatches);

            // Fetch my progress for these matches
            const matchIds = mData.map(m => m.id);
            if (matchIds.length > 0) {
                const { data: guesses } = await supabase
                    .from('match_guesses')
                    .select('match_id')
                    .eq('user_id', session.user.id)
                    .in('match_id', matchIds);

                if (guesses) {
                    const counts: Record<string, number> = {};
                    guesses.forEach(g => {
                        counts[g.match_id] = (counts[g.match_id] || 0) + 1;
                    });
                    setMyMatchCounts(counts);
                }
            }
        }
    };

    const handleCreateChampionship = async () => {
        if (!newChampionshipName || selectedUserIds.length < 2) return;
        const { error } = await supabase.rpc('create_championship', {
            name: newChampionshipName,
            participant_ids: selectedUserIds,
            p_game_mode_id: selectedGameModeId || null
        });
        if (!error) {
            setView('list');
            fetchChampionships();
            setNewChampionshipName('');
            setSelectedUserIds([]);
            setSelectedGameModeId(null);
        } else {
            console.error(error);
            alert('Error creating championship');
        }
    };

    const loadUsers = async () => {
        const { data, error } = await supabase.rpc('get_all_users');
        if (data) setUsers(data);
        if (error) console.error('Error loading users', error);
    };

    const handleDeleteChampionship = async (championshipId: string) => {
        if (window.confirm('Are you sure you want to delete this championship? This action cannot be undone.')) {
            const { error } = await supabase.rpc('delete_championship', { p_championship_id: championshipId });
            if (!error) {
                fetchChampionships();
                if (id === championshipId) {
                    navigate('/championships');
                }
            } else {
                console.error('Error deleting championship', error);
                alert('Error deleting championship');
            }
        }
    };

    const nextRound = useMemo(() => {
        const rounds = Array.from(
            new Set(matches.map(m => m.round_number).filter((r): r is number => r != null))
        );
        rounds.sort((a, b) => Number(a) - Number(b));
        for (const r of rounds) {
            const roundMatches = matches.filter(m => m.round_number === r);
            if (roundMatches.some(m => m.status !== 'completed')) {
                return r;
            }
        }
        return rounds.length > 0 ? rounds[rounds.length - 1] : null;
    }, [matches]);

    useEffect(() => {
        if (nextRound && selectedFixtureRound === null) {
            setSelectedFixtureRound(nextRound);
        }
    }, [nextRound, selectedFixtureRound]);

    return (
        <div className="h-full bg-gray-900 text-white p-8 pl-20 overflow-y-auto pb-20">
            {showMetrics && selectedChampionship && (
                <ChampionshipMetrics
                    championshipId={selectedChampionship.id}
                    championshipName={selectedChampionship.name}
                    onClose={() => setShowMetrics(false)}
                />
            )}
            {selectedRecapMatchId && (
                <MatchRecap
                    matchId={selectedRecapMatchId}
                    onClose={() => setSelectedRecapMatchId(null)}
                />
            )}
            <div className="flex items-center gap-4 mb-8">
                {view === 'detail' && (
                    <Link
                        to="/championships"
                        className="text-blue-400 hover:underline flex items-center gap-2 mr-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to List
                    </Link>
                )}
                {view === 'create' && (
                    <button
                        onClick={() => setView('list')}
                        className="text-blue-400 hover:underline flex items-center gap-2 mr-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to List
                    </button>
                )}
                <h1 className="text-4xl font-bold">Championships</h1>
                {view === 'detail' && selectedChampionship && (
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-bold text-blue-500">
                            - {selectedChampionship.name}
                        </h1>
                        <button
                            onClick={() => setShowMetrics(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg hover:scale-105 active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Ver Métricas
                        </button>
                    </div>
                )}
            </div>

            {view === 'list' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">All Championships</h2>
                    {isAdmin && (
                        <button
                            onClick={() => {
                                setView('create');
                                loadUsers();
                            }}
                            className="bg-green-600 px-6 py-3 rounded mb-6 font-bold hover:bg-green-700 transition-colors"
                        >
                            Create New Championship
                        </button>
                    )}
                    <div className="grid gap-4">
                        {championships.length === 0 && <p className="text-gray-400">No championships found.</p>}
                        {championships.map(c => (
                            <Link
                                key={c.id}
                                to={`/championships/${c.id}`}
                                className="bg-gray-800 p-6 rounded cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700 block"
                            >
                                <h2 className="text-2xl font-bold mb-2">{c.name}</h2>
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-4 text-sm text-gray-400">
                                        <span
                                            className={`px-2 py-1 rounded ${c.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-blue-900 text-blue-200'}`}
                                        >
                                            {c.status.toUpperCase()}
                                        </span>
                                        <span className="self-center">{new Date(c.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleDeleteChampionship(c.id);
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded transition-colors text-sm"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {view === 'create' && (
                <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded shadow-xl">
                    <h2 className="text-2xl mb-6 font-bold">Create Championship</h2>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2">Championship Name</label>
                        <input
                            className="w-full bg-gray-700 p-3 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Summer Cup 2025"
                            value={newChampionshipName}
                            onChange={e => setNewChampionshipName(e.target.value)}
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-400 mb-2">Game Mode</label>
                        <select
                            className="w-full bg-gray-700 p-3 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedGameModeId || ''}
                            onChange={e => setSelectedGameModeId(e.target.value || null)}
                        >
                            <option value="">Free (All world)</option>
                            {gameModes.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-8">
                        <h3 className="mb-2 text-gray-400">Select Participants (Min 2)</h3>
                        <div className="max-h-60 overflow-y-auto bg-gray-900 p-2 rounded border border-gray-700">
                            {users.map(u => (
                                <div key={u.id} className="flex items-center p-2 hover:bg-gray-800 rounded">
                                    <input
                                        type="checkbox"
                                        checked={selectedUserIds.includes(u.id)}
                                        onChange={e => {
                                            if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                                            else setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                                        }}
                                        className="mr-3 w-5 h-5 accent-blue-600"
                                    />
                                    <span>{u.email}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-4">
                        <button onClick={() => setView('list')} className="bg-gray-600 px-6 py-2 rounded hover:bg-gray-500 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateChampionship}
                            disabled={!newChampionshipName || selectedUserIds.length < 2}
                            className="bg-blue-600 px-6 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create
                        </button>
                    </div>
                </div>
            )}

            {view === 'detail' && selectedChampionship && (
                <div>
                    <div className="grid lg:grid-cols-2 gap-8">
                        <div className="bg-gray-800 p-6 rounded shadow-lg">
                            <h3 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Standings</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-gray-400 text-sm">
                                            <th className="p-2">Player</th>
                                            <th className="p-2">Pts</th>
                                            <th className="p-2">RW</th>
                                            <th className="p-2">MP</th>
                                            <th className="p-2">W</th>
                                            <th className="p-2">D</th>
                                            <th className="p-2">L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {participants
                                            .sort((a, b) => b.points - a.points)
                                            .map((p, idx) => {
                                                const totalRoundsWon = matches.reduce((acc, m) => {
                                                    if (m.player1_id === p.user_id) return acc + (m.player1_rounds_won || 0);
                                                    if (m.player2_id === p.user_id) return acc + (m.player2_rounds_won || 0);
                                                    return acc;
                                                }, 0);

                                                return (
                                                    <tr
                                                        key={p.id}
                                                        className={`border-b border-gray-700 ${idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}
                                                    >
                                                        <td className="p-2 font-medium">{p.email}</td>
                                                        <td className="p-2 font-bold text-yellow-400">{p.points}</td>
                                                        <td className="p-2 font-bold text-blue-400">{totalRoundsWon}</td>
                                                        <td className="p-2">{p.matches_played}</td>
                                                        <td className="p-2 text-green-400">{p.wins}</td>
                                                        <td className="p-2 text-gray-400">{p.draws}</td>
                                                        <td className="p-2 text-red-400">{p.losses}</td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="bg-gray-800 p-6 rounded shadow-lg flex flex-col h-full">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                <h3 className="text-xl font-bold">Fixture</h3>
                                {matches.length > 0 && selectedFixtureRound !== null && (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setSelectedFixtureRound(prev => Math.max(1, (prev || 1) - 1))}
                                            disabled={selectedFixtureRound <= 1}
                                            className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <div className="flex gap-1">
                                            {Array.from(new Set(matches.map(m => m.round_number))).sort((a, b) => (Number(a) || 0) - (Number(b) || 0)).map(r => (
                                                <button
                                                    key={r}
                                                    onClick={() => setSelectedFixtureRound(r)}
                                                    className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-all ${selectedFixtureRound === r ? 'bg-blue-600 font-bold' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const maxRound = Math.max(...matches.map(m => m.round_number || 0));
                                                setSelectedFixtureRound(prev => Math.min(maxRound, (prev || 1) + 1));
                                            }}
                                            disabled={selectedFixtureRound >= Math.max(...matches.map(m => m.round_number || 0))}
                                            className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                {selectedFixtureRound !== null && (
                                    <div className="animate-fadeIn">
                                        <div className="flex items-center justify-between mb-4 sticky top-0 bg-gray-800 py-2 z-10 border-b border-gray-700/50">
                                            <h4 className="font-bold text-blue-400">
                                                Round {selectedFixtureRound}
                                            </h4>
                                            {selectedFixtureRound === nextRound && (
                                                (() => {
                                                    const pendingMatch = matches.find(m => m.round_number === selectedFixtureRound && m.status !== 'completed' && (m.player1_id === session.user.id || m.player2_id === session.user.id));

                                                    const isMyMatchFinished = pendingMatch ? (myMatchCounts[pendingMatch.id] || 0) >= 6 : false;

                                                    return (
                                                        <button
                                                            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all transform hover:scale-105 ${pendingMatch && !isMyMatchFinished ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20' : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'}`}
                                                            onClick={() => {
                                                                if (pendingMatch && !isMyMatchFinished) navigate(`/game/${pendingMatch.id}`);
                                                            }}
                                                            disabled={selectedFixtureRound !== nextRound || !pendingMatch || isMyMatchFinished}
                                                        >
                                                            {pendingMatch ? (isMyMatchFinished ? 'Waiting for Opponent' : 'Play Match') : 'Locked'}
                                                        </button>
                                                    );
                                                })()
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {matches
                                                .filter(m => m.round_number === selectedFixtureRound)
                                                .map(m => (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => {
                                                            if (m.status === 'completed') {
                                                                setSelectedRecapMatchId(m.id);
                                                            }
                                                        }}
                                                        className={`bg-gray-900/50 hover:bg-gray-700/50 p-3 rounded-lg flex items-center gap-3 border border-gray-700/50 transition-all ${m.status === 'completed' ? 'cursor-pointer' : ''}`}
                                                    >
                                                        <div className={`flex-1 text-right text-sm font-medium truncate ${m.status === 'completed' && m.player1_rounds_won! > m.player2_rounds_won! ? 'text-green-400' : ''}`}>
                                                            {m.player1_email}
                                                        </div>
                                                        <div className="flex items-center justify-center bg-gray-950 px-3 py-1 rounded min-w-[70px] border border-gray-800">
                                                            <span className="font-mono font-bold text-blue-400">
                                                                {m.player1_rounds_won ?? 0}
                                                            </span>
                                                            <span className="mx-2 text-gray-600">-</span>
                                                            <span className="font-mono font-bold text-blue-400">
                                                                {m.player2_rounds_won ?? 0}
                                                            </span>
                                                        </div>
                                                        <div className={`flex-1 text-left text-sm font-medium truncate ${m.status === 'completed' && m.player2_rounds_won! > m.player1_rounds_won! ? 'text-green-400' : ''}`}>
                                                            {m.player2_email}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Championships;
