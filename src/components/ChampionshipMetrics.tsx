import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { googleMapsService } from '../services/googleMapsService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
    ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
    Trophy, Target, TrendingUp, Award, Zap, Ghost, Eye, Navigation, Filter,
    Globe, BarChart2, Hash, Clock, Activity, Map as MapIcon, Flame
} from 'lucide-react';

declare const google: any;

interface ChampionshipMetricsProps {
    championshipId: string;
    championshipName: string;
    onClose: () => void;
}

interface MetricData {
    matches: any[];
    guesses: any[];
    participants: any[];
    profiles: any[];
    rounds: any[];
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const getContinent = (lat: number, lng: number) => {
    if (lat > 7 && lat < 85 && lng > -170 && lng < -50) return 'N. América';
    if (lat > -60 && lat < 15 && lng > -90 && lng < -30) return 'S. América';
    if (lat > 35 && lat < 72 && lng > -25 && lng < 45) return 'Europa';
    if (lat > -35 && lat < 38 && lng > -20 && lng < 52) return 'África';
    if (lat > -10 && lat < 80 && lng > 25 && lng < 180) return 'Asia';
    if (lat > -50 && lat < 0 && lng > 110 && lng < 180) return 'Oceanía';
    return 'Otros';
};

const ChampionshipMetrics: React.FC<ChampionshipMetricsProps> = ({ championshipId, championshipName, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MetricData | null>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const heatMapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const heatMapInstance = useRef<any>(null);

    useEffect(() => {
        fetchMetricsData();
    }, [championshipId]);

    const fetchMetricsData = async () => {
        setLoading(true);
        try {
            const { data: matches } = await supabase.from('matches').select('*').eq('championship_id', championshipId);
            const matchIds = matches?.map(m => m.id) || [];

            const [guessesRes, participantsRes, profilesRes, roundsRes] = await Promise.all([
                supabase.from('match_guesses').select('*').in('match_id', matchIds),
                supabase.from('championship_participants').select('*').eq('championship_id', championshipId),
                supabase.from('profiles').select('id, username'),
                supabase.from('match_rounds').select('*').in('match_id', matchIds)
            ]);

            setData({
                matches: matches || [],
                guesses: guessesRes.data || [],
                participants: participantsRes.data || [],
                profiles: profilesRes.data || [],
                rounds: roundsRes.data || []
            });
        } catch (err) {
            console.error('Error fetching metrics:', err);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        if (!data) return null;

        const { matches, guesses, participants, profiles, rounds } = data;
        const getUserName = (id: string) => profiles.find(p => p.id === id)?.username || 'Unknown';

        // 1. Averages
        const playerStats = participants.map(p => {
            const playerGuesses = guesses.filter(g => g.user_id === p.user_id);
            const totalScore = playerGuesses.reduce((acc, g) => acc + (g.score || 0), 0);
            const totalDistance = playerGuesses.reduce((acc, g) => acc + (g.distance || 0), 0);
            const count = playerGuesses.length || 1;

            return {
                name: getUserName(p.user_id),
                avgScore: Math.round(totalScore / count),
                avgDistance: Math.round(totalDistance / count),
                maxScore: Math.max(...playerGuesses.map(g => g.score || 0), 0),
                totalRounds: playerGuesses.length,
            };
        });

        // 2. Continents Performance
        const continents = ['N. América', 'S. América', 'Europa', 'África', 'Asia', 'Oceanía'];
        const continentData = continents.map(cont => {
            const entry: any = { name: cont };
            let continentTotalAvg = 0;
            let playersCount = 0;

            participants.forEach(p => {
                const playerContinentGuesses = guesses.filter(g => {
                    if (g.user_id !== p.user_id) return false;
                    const r = rounds.find(rd => rd.match_id === g.match_id && rd.round_number === g.round_number);
                    return r && getContinent(r.lat, r.lng) === cont;
                });
                const avg = playerContinentGuesses.length
                    ? playerContinentGuesses.reduce((acc, g) => acc + (g.score || 0), 0) / playerContinentGuesses.length
                    : 0;

                const roundedAvg = Math.round(avg);
                entry[getUserName(p.user_id)] = roundedAvg;

                if (avg > 0) {
                    continentTotalAvg += avg;
                    playersCount++;
                }
            });

            entry._sortMetric = playersCount > 0 ? continentTotalAvg / playersCount : 0;
            return entry;
        }).sort((a, b) => b._sortMetric - a._sortMetric);

        return { playerStats, continentData };
    }, [data]);

    // Initialize Map for Target Locations
    useEffect(() => {
        if (!loading && mapRef.current && data?.rounds.length) {
            const initMap = async () => {
                await googleMapsService.load();
                mapInstance.current = new google.maps.Map(mapRef.current, {
                    center: { lat: 20, lng: 0 },
                    zoom: 2,
                    mapId: '4504f9d97365a6c',
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                    ]
                });

                data.rounds.forEach((round, i) => {
                    new google.maps.Marker({
                        position: { lat: round.lat, lng: round.lng },
                        map: mapInstance.current,
                        animation: google.maps.Animation.DROP,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 6,
                            fillColor: "#FBBF24",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#000",
                        },
                        title: `Ubicación Real - Ronda ${round.round_number}`
                    });
                });
            };
            initMap();
        }
    }, [loading, data]);

    // Initialize Heatmap for User Guesses
    useEffect(() => {
        if (!loading && heatMapRef.current && data?.guesses.length) {
            const initHeatMap = async () => {
                await googleMapsService.load();
                heatMapInstance.current = new google.maps.Map(heatMapRef.current, {
                    center: { lat: 20, lng: 0 },
                    zoom: 2,
                    mapId: '4504f9d97365a6c',
                    disableDefaultUI: true,
                    zoomControl: true,
                });

                const heatmapData = data.guesses
                    .filter(g => g.lat && g.lng)
                    .map(g => new google.maps.LatLng(g.lat, g.lng));

                const heatmap = new google.maps.visualization.HeatmapLayer({
                    data: heatmapData,
                    map: heatMapInstance.current,
                    radius: 30,
                    opacity: 0.8,
                    gradient: [
                        'rgba(0, 255, 255, 0)',
                        'rgba(0, 255, 255, 1)',
                        'rgba(0, 191, 255, 1)',
                        'rgba(0, 127, 255, 1)',
                        'rgba(0, 63, 255, 1)',
                        'rgba(0, 0, 255, 1)',
                        'rgba(0, 0, 223, 1)',
                        'rgba(0, 0, 191, 1)',
                        'rgba(0, 0, 159, 1)',
                        'rgba(0, 0, 127, 1)',
                        'rgba(63, 0, 91, 1)',
                        'rgba(127, 0, 63, 1)',
                        'rgba(191, 0, 31, 1)',
                        'rgba(255, 0, 0, 1)'
                    ]
                });
            };
            initHeatMap();
        }
    }, [loading, data]);

    if (loading) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-[#090a0f] flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#090a0f]/95 backdrop-blur-md border-b border-white/10 px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
                        <Activity className="text-white w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Global <span className="text-blue-500">Analytics</span></h2>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-1">{championshipName}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 bg-white/5 hover:bg-red-500 rounded-2xl transition-all">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="p-8 max-w-[1600px] mx-auto w-full space-y-12 pb-20">
                {/* Averages Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-[#15161e] p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
                        <div className="flex items-center gap-4 mb-6 text-blue-400">
                            <Target className="w-6 h-6" />
                            <h3 className="font-black uppercase tracking-widest text-sm">Average Score</h3>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.playerStats}>
                                    <XAxis dataKey="name" hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#1a1b23', border: 'none' }} />
                                    <Bar dataKey="avgScore" fill="#3B82F6" radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-[#15161e] p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
                        <div className="flex items-center gap-4 mb-6 text-emerald-400">
                            <Navigation className="w-6 h-6" />
                            <h3 className="font-black uppercase tracking-widest text-sm">Average Distance (km)</h3>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.playerStats}>
                                    <XAxis dataKey="name" hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#1a1b23', border: 'none' }} />
                                    <Bar dataKey="avgDistance" fill="#10B981" radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-[#15161e] p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
                        <div className="flex items-center gap-4 mb-6 text-yellow-400">
                            <Trophy className="w-6 h-6" />
                            <h3 className="font-black uppercase tracking-widest text-sm">Max Round Points</h3>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.playerStats}>
                                    <XAxis dataKey="name" hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#1a1b23', border: 'none' }} />
                                    <Bar dataKey="maxScore" fill="#FBBF24" radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>


                {/* Heatmap Section */}
                <div className="bg-[#15161e] p-10 rounded-[3rem] border border-white/5 shadow-2xl h-[600px] flex flex-col group overflow-hidden relative">
                    <div className="absolute -right-20 -top-20 p-20 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Flame className="w-80 h-80 text-orange-500" />
                    </div>
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-orange-500/10 rounded-3xl">
                                <Flame className="text-orange-400 w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white italic uppercase">Mapa de Calor (Guesses)</h3>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Zonas donde los usuarios concentran sus disparos</p>
                            </div>
                        </div>
                        <span className="bg-orange-500/10 text-orange-500 text-xs font-black px-4 py-2 rounded-full uppercase italic border border-orange-500/20">
                            {data?.guesses.length} Guesses Analizados
                        </span>
                    </div>
                    <div ref={heatMapRef} className="flex-1 rounded-[2rem] overflow-hidden border border-white/10 shadow-inner bg-[#0c0d12]" />
                </div>

                {/* Map & Continents Row */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                    {/* World Map of Points */}
                    <div className="bg-[#15161e] p-10 rounded-[3rem] border border-white/5 shadow-2xl h-[600px] flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-yellow-500/10 rounded-3xl">
                                    <MapIcon className="text-yellow-400 w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-white italic uppercase">Mapa de Ubicaciones Reales</h3>
                            </div>
                            <span className="bg-yellow-500/10 text-yellow-500 text-xs font-black px-4 py-2 rounded-full uppercase italic">
                                {data?.rounds.length} Puntos Totales
                            </span>
                        </div>
                        <div ref={mapRef} className="flex-1 rounded-[2rem] overflow-hidden border border-white/10 shadow-inner bg-[#0c0d12]" />
                    </div>

                    {/* Continent Accuracy */}
                    <div className="bg-[#15161e] p-10 rounded-[3rem] border border-white/5 shadow-2xl h-[600px] flex flex-col">
                        <div className="flex items-center gap-5 mb-10">
                            <div className="p-4 bg-blue-500/10 rounded-3xl">
                                <Globe className="text-blue-400 w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic uppercase">Puntería por Continente</h3>
                        </div>
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.continentData} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#252631" horizontal={false} />
                                    <XAxis type="number" domain={[0, 100]} hide />
                                    <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={12} width={100} fontWeight="black" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1b23', border: 'none', borderRadius: '16px' }}
                                        itemSorter={(item) => -(item.value as number)}
                                    />
                                    <Legend />
                                    {stats?.playerStats.map((p, idx) => (
                                        <Bar
                                            key={p.name}
                                            dataKey={p.name}
                                            fill={COLORS[idx % COLORS.length]}
                                            radius={[0, 10, 10, 0]}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="py-20 text-center opacity-30">
                    <div className="w-24 h-1 bg-white/20 mx-auto rounded-full mb-4" />
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.8em]">MeroMetrics Simulation Engine</p>
                </div>
            </div>
        </div>
    );
};

export default ChampionshipMetrics;
