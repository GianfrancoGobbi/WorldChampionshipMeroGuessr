import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Championship, Match, Participant } from '../types';

interface ChampionshipsProps {
    session: Session;
    onBack: () => void;
    onPlayMatch: (matchId: string) => void;
}

const Championships: React.FC<ChampionshipsProps> = ({ session, onBack, onPlayMatch }) => {
    const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
    const [championships, setChampionships] = useState<Championship[]>([]);
    const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
    const [newChampionshipName, setNewChampionshipName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    // Initial load
    useEffect(() => {
        checkAdmin();
        fetchChampionships();
    }, []);

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

        console.log('Fetched Participants Data:', pData);
        console.log('Fetched Matches Data:', mData);

        if (pData) {
            const mappedParticipants = pData.map(p => ({
                ...p,
                email: profiles?.find(u => u.id === p.user_id)?.username || 'Unknown User',
            }));
            setParticipants(mappedParticipants);
            console.log('Processed Participants State:', mappedParticipants);
        }

        if (mData) {
            const mappedMatches = mData.map(m => ({
                ...m,
                player1_email: profiles?.find(u => u.id === m.player1_id)?.username || 'Unknown User',
                player2_email: profiles?.find(u => u.id === m.player2_id)?.username || 'Unknown User',
            }));
            setMatches(mappedMatches);
            console.log('Processed Matches State:', mappedMatches);
        }
    };

    const handleCreateChampionship = async () => {
        if (!newChampionshipName || selectedUserIds.length < 2) return;
        const { error } = await supabase.rpc('create_championship', {
            name: newChampionshipName,
            participant_ids: selectedUserIds,
        });
        if (!error) {
            setView('list');
            fetchChampionships();
            setNewChampionshipName('');
            setSelectedUserIds([]);
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

    const updateMatchScore = async (matchId: string, p1Score: number, p2Score: number) => {
        const { error } = await supabase.rpc('update_match_result', {
            match_id: matchId,
            p1_score: p1Score,
            p2_score: p2Score,
        });
        if (!error && selectedChampionship) {
            fetchChampionshipDetails(selectedChampionship.id);
        } else if (error) {
            alert('Error updating match');
        }
    };

    const handleDeleteChampionship = async (championshipId: string) => {
        if (window.confirm('Are you sure you want to delete this championship? This action cannot be undone.')) {
            const { error } = await supabase.rpc('delete_championship', { p_championship_id: championshipId });
            if (!error) {
                fetchChampionships();
            } else {
                console.error('Error deleting championship', error);
                alert('Error deleting championship');
            }
        }
    };

    // Determine the next round that still has pending matches
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
        return null;
    }, [matches]);

    return (
        <div className="h-full bg-gray-900 text-white p-8 pl-20 overflow-y-auto pb-20">
            <div className="flex items-center gap-4 mb-8">
                {view === 'detail' && (
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
                    <h1 className="text-4xl font-bold text-blue-500 ml-2">
                        - {selectedChampionship.name}
                    </h1>
                )}
            </div>

            {view === 'list' && (
                <div>
                    {/* My Pending Matches */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 text-blue-400">My Pending Matches</h2>
                        {matches.filter(
                            m => (m.player1_id === session.user.id || m.player2_id === session.user.id) && m.status === 'pending'
                        ).length === 0 ? (
                            <p className="text-gray-400">No pending matches.</p>
                        ) : (
                            <div className="grid gap-4">
                                {matches
                                    .filter(
                                        m => (m.player1_id === session.user.id || m.player2_id === session.user.id) && m.status === 'pending'
                                    )
                                    .sort((a, b) => (a.round_number || 0) - (b.round_number || 0))
                                    .map(m => (
                                        <div key={m.id} className="bg-gray-800 p-6 rounded border border-blue-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-400 mb-1">Round {m.round_number} of 6</p>
                                                <p className="font-bold text-lg">
                                                    {m.player1_email} vs {m.player2_email}
                                                </p>
                                                <p className="text-sm text-gray-400 mt-1">
                                                    {m.player1_score !== null && m.player2_score !== null ? (
                                                        `Score: ${m.player1_score} - ${m.player2_score}`
                                                    ) : (
                                                        'Match not started'
                                                    )}
                                                </p>
                                            </div>
                                            {(m.player1_id === session.user.id || m.player2_id === session.user.id) && (
                                                <button
                                                    onClick={() => onPlayMatch(m.id)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition-colors w-full md:w-auto"
                                                >
                                                    Play Match
                                                </button>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* All Championships */}
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
                            <div
                                key={c.id}
                                onClick={() => {
                                    setSelectedChampionship(c);
                                    setView('detail');
                                    fetchChampionshipDetails(c.id);
                                }}
                                className="bg-gray-800 p-6 rounded cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700"
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
                                                e.stopPropagation();
                                                handleDeleteChampionship(c.id);
                                            }}
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded transition-colors text-sm"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
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
                        {/* Standings */}
                        <div className="bg-gray-800 p-6 rounded shadow-lg">
                            <h3 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Standings</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-gray-400 text-sm">
                                            <th className="p-2">Player</th>
                                            <th className="p-2">Pts</th>
                                            <th className="p-2">MP</th>
                                            <th className="p-2">W</th>
                                            <th className="p-2">D</th>
                                            <th className="p-2">L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {participants
                                            .sort((a, b) => b.points - a.points)
                                            .map((p, idx) => (
                                                <tr
                                                    key={p.id}
                                                    className={`border-b border-gray-700 ${idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}
                                                >
                                                    <td className="p-2 font-medium">{p.email}</td>
                                                    <td className="p-2 font-bold text-yellow-400">{p.points}</td>
                                                    <td className="p-2">{p.matches_played}</td>
                                                    <td className="p-2 text-green-400">{p.wins}</td>
                                                    <td className="p-2 text-gray-400">{p.draws}</td>
                                                    <td className="p-2 text-red-400">{p.losses}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {/* Fixture */}
                        <div className="bg-gray-800 p-6 rounded shadow-lg">
                            <h3 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Fixture</h3>
                            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar pb-20">
                                {Array.from(
                                    new Set(matches.map(m => m.round_number).filter((r): r is number => r != null))
                                )
                                    .sort((a, b) => Number(a) - Number(b))
                                    .map(round => {
                                        const isNext = round === nextRound;
                                        const pendingMatch = matches.find(m => m.round_number === round && m.status !== 'completed' && (m.player1_id === session.user.id || m.player2_id === session.user.id));
                                        return (
                                            <div key={round} className="mb-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-bold text-blue-400 mb-3 sticky top-0 bg-gray-800 py-1">
                                                        Round {round}
                                                    </h4>
                                                    <button
                                                        className={`ml-2 px-3 py-1 rounded ${isNext && pendingMatch ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-400 cursor-not-allowed'} text-white`}
                                                        onClick={() => {
                                                            if (pendingMatch) onPlayMatch(pendingMatch.id);
                                                        }}
                                                        disabled={!isNext || !pendingMatch}
                                                    >
                                                        Play
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {matches
                                                        .filter(m => m.round_number === round)
                                                        .map(m => (
                                                            <div
                                                                key={m.id}
                                                                className="bg-gray-900 p-4 rounded flex flex-col sm:flex-row justify-between items-center gap-2 border border-gray-700"
                                                            >
                                                                <div className="flex-1 text-center sm:text-right font-medium truncate w-full">
                                                                    {m.player1_email}
                                                                </div>
                                                                <div className="flex items-center gap-3 bg-gray-800 px-3 py-1 rounded">
                                                                    <span className="font-bold text-lg">
                                                                        {`${m.player1_rounds_won ?? 0} - ${m.player2_rounds_won ?? 0}`}
                                                                    </span>
                                                                </div>
                                                                <div className="flex-1 text-center sm:text-left font-medium truncate w-full">
                                                                    {m.player2_email}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Championships;
