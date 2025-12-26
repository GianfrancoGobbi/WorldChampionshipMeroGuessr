import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { googleMapsService } from '../services/googleMapsService';

declare const google: any;

interface MatchRecapProps {
    matchId: string;
    onClose: () => void;
}

interface MatchGuess {
    id: string;
    round_number: number;
    lat: number;
    lng: number;
    user_id: string;
    score: number;
    distance: number;
}

interface MatchRound {
    round_number: number;
    lat: number;
    lng: number;
}

interface PlayerInfo {
    id: string;
    username: string;
    color: string;
}

const MatchRecap: React.FC<MatchRecapProps> = ({ matchId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [rounds, setRounds] = useState<MatchRound[]>([]);
    const [guesses, setGuesses] = useState<MatchGuess[]>([]);
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [selectedRound, setSelectedRound] = useState<number>(1);

    const mapRef = useRef<HTMLDivElement>(null);
    const streetViewRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any | null>(null);
    const panoramaInstance = useRef<any | null>(null);
    const markersRef = useRef<any[]>([]);
    const linesRef = useRef<any[]>([]);

    useEffect(() => {
        fetchData();
    }, [matchId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch match details to get players
            const { data: matchData, error: matchError } = await supabase
                .from('matches')
                .select('player1_id, player2_id')
                .eq('id', matchId)
                .single();

            if (matchError) throw matchError;

            // Fetch profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username')
                .in('id', [matchData.player1_id, matchData.player2_id]);

            if (profilesError) throw profilesError;

            const playerInfos = profiles.map((p, index) => ({
                id: p.id,
                username: p.username,
                color: index === 0 ? '#3B82F6' : '#EF4444' // Blue vs Red
            }));
            setPlayers(playerInfos);

            // Fetch rounds (real locations)
            // Assuming match_rounds table or similar logic. 
            // If match_rounds table doesn't exist, we might have to rely on a different source, 
            // but MeroGuessr.tsx implies get_or_create_match_round. 
            // Let's try to query match_rounds directly.
            const { data: roundsData, error: roundsError } = await supabase
                .from('match_rounds')
                .select('round_number, lat, lng')
                .eq('match_id', matchId)
                .order('round_number');

            if (roundsError) throw roundsError;
            setRounds(roundsData as MatchRound[]);

            // Fetch guesses
            const { data: guessesData, error: guessesError } = await supabase
                .from('match_guesses')
                .select('*')
                .eq('match_id', matchId);

            if (guessesError) throw guessesError;
            setGuesses(guessesData as MatchGuess[]);

        } catch (error) {
            console.error('Error fetching match recap data:', error);
            alert('Error loading verification data');
        } finally {
            setLoading(false);
        }
    };

    const initMap = async () => {
        if (!mapRef.current || !streetViewRef.current || loading || rounds.length === 0) return;

        // Ensure Maps API is loaded
        const loaded = await googleMapsService.load();
        if (!loaded) {
            console.error("Google Maps API failed to load");
            alert("Google Maps API failed to load");
            return;
        }

        // Initialize Map
        if (!mapInstance.current) {
            mapInstance.current = new google.maps.Map(mapRef.current, {
                center: { lat: 20, lng: 0 },
                zoom: 2,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false, // Prevent clicking POIs
                mapId: '3a3b32445c2f82e'
            });
        }

        // Initialize StreetView
        if (!panoramaInstance.current) {
            panoramaInstance.current = new google.maps.StreetViewPanorama(streetViewRef.current, {
                position: { lat: 0, lng: 0 },
                pov: { heading: 0, pitch: 0 },
                zoom: 1,
                addressControl: false,
                linksControl: false,
                panControl: false, // We might want pan control? User said "foto". Usually easier to navigate if enabled.
                enableCloseButton: false,
                showRoadLabels: false,
            });
        }

        updateMapContent();
    };

    const updateMapContent = () => {
        if (!mapInstance.current || rounds.length === 0) return;

        // Clear existing markers/lines
        markersRef.current.forEach(m => m.setMap(null));
        linesRef.current.forEach(l => l.setMap(null));
        markersRef.current = [];
        linesRef.current = [];

        const bounds = new google.maps.LatLngBounds();

        // Plot rounds / guesses
        rounds.forEach(round => {
            const realLoc = { lat: round.lat, lng: round.lng };

            // Add real location marker
            const realMarker = new google.maps.Marker({
                position: realLoc,
                map: mapInstance.current,
                icon: {
                    url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
                },
                title: `Round ${round.round_number} (Target)`
            });
            markersRef.current.push(realMarker);
            bounds.extend(realLoc);

            // Find guesses for this round
            const roundGuesses = guesses.filter(g => g.round_number === round.round_number);

            roundGuesses.forEach(guess => {
                const guessLoc = { lat: guess.lat, lng: guess.lng };
                const player = players.find(p => p.id === guess.user_id);
                const color = player ? player.color : '#9CA3AF'; // Default gray

                // Add guess marker
                // Using SVG path for custom colored markers
                const pinSVGHole = "M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z";
                const labelOrigin = new google.maps.Point(12, 15);

                const guessMarker = new google.maps.Marker({
                    position: guessLoc,
                    map: mapInstance.current,
                    icon: {
                        path: pinSVGHole,
                        fillColor: color,
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: "white",
                        scale: 1.5,
                        anchor: new google.maps.Point(12, 22),
                    },
                    title: `${player?.username || 'Unknown'} - Round ${round.round_number}`,
                    zIndex: 100 // On top of red dots
                });
                markersRef.current.push(guessMarker);
                bounds.extend(guessLoc);

                // Draw line if it's the selected round or generally?
                // Visual clutter might be high if we draw all lines. 
                // Let's only draw lines for the SELECTED round to keep it clean, 
                // but show all markers.
                if (round.round_number === selectedRound) {
                    const line = new google.maps.Polyline({
                        path: [realLoc, guessLoc],
                        geodesic: true,
                        strokeColor: color,
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        map: mapInstance.current,
                        icons: [{
                            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                            offset: '100%'
                        }]
                    });
                    linesRef.current.push(line);
                }
            });
        });

        // Fit bounds
        if (!bounds.isEmpty()) {
            mapInstance.current.fitBounds(bounds, 50);
        }

        // Update Street View
        const selectedRoundData = rounds.find(r => r.round_number === selectedRound);
        if (selectedRoundData && panoramaInstance.current) {
            panoramaInstance.current.setPosition({ lat: selectedRoundData.lat, lng: selectedRoundData.lng });
            // Should probably reset POV?
            // panoramaInstance.current.setPov({ heading: 0, pitch: 0 });
        }
    };

    useEffect(() => {
        if (!loading && rounds.length > 0) {
            initMap();
        }
    }, [loading, rounds]);

    useEffect(() => {
        updateMapContent();
    }, [selectedRound, guesses]); // Update when round changes

    if (loading) {
        return (
            <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center text-white">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p>Loading Match Recap...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="h-16 bg-gray-800 flex items-center justify-between px-6 border-b border-gray-700 shrink-0">
                <h2 className="text-xl font-bold text-white">Match Recap</h2>

                <div className="flex bg-gray-700 rounded p-1 gap-1">
                    {rounds.map(r => (
                        <button
                            key={r.round_number}
                            onClick={() => setSelectedRound(r.round_number)}
                            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${selectedRound === r.round_number
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-gray-600 text-gray-300'
                                }`}
                        >
                            R{r.round_number}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <span className="text-gray-300">Target</span>
                        </div>
                        {players.map(p => (
                            <div key={p.id} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                                <span className="text-gray-300">{p.username}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-full transition-colors text-white"
                        title="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                {/* Street View */}
                <div className="w-full md:w-1/2 h-1/2 md:h-full relative border-r border-gray-700">
                    <div ref={streetViewRef} className="w-full h-full bg-gray-900" />
                    <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded backdrop-blur-sm pointer-events-none">
                        Round {selectedRound} Location
                    </div>
                </div>

                {/* Map */}
                <div className="w-full md:w-1/2 h-1/2 md:h-full relative">
                    <div ref={mapRef} className="w-full h-full bg-gray-800" />
                </div>
            </div>
        </div>
    );
};

export default MatchRecap;
