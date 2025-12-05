import React, { useEffect, useState, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from '../../supabaseClient';
import { googleMapsService } from '../services/googleMapsService';
import { getOrGenerateCurrentRoundLocation, fetchRoundsPlayedToday, saveScore } from '../services/supabaseService';
import { formatTime } from '../utils/formatTime';
import { isPlaytime } from '../utils/timeCheck';
import type { GameState, Location, ScoreBreakdown, GoogleLatLng } from '../types';

import RankingsDisplay from './RankingsDisplay';
import AdPopup from './AdPopup';
import Compass from './Compass';

declare const google: any;

const MeroGuessr: React.FC<{ session: Session; onOpenChampionships: () => void; matchId: string | null; onMatchExit: () => void }> = ({ session, onOpenChampionships, matchId, onMatchExit }) => {
    const [gameState, setGameState] = useState<GameState>('home');
    const [roundsPlayedToday, setRoundsPlayedToday] = useState(0);
    const [loadingRounds, setLoadingRounds] = useState(true);
    const [realLocation, setRealLocation] = useState<Location | null>(null);
    const [guessLocation, setGuessLocation] = useState<GoogleLatLng | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [score, setScore] = useState<number | null>(null);
    const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(90);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pov, setPov] = useState({ heading: 0, unwrappedHeading: 0 });

    // Match specific state
    const [matchRoundsPlayed, setMatchRoundsPlayed] = useState(0);
    const [matchLocations, setMatchLocations] = useState<Location[]>([]);

    const mapRef = useRef<HTMLDivElement>(null);
    const streetViewRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any | null>(null);
    const panoramaInstance = useRef<any | null>(null);
    const guessMarker = useRef<any | null>(null);
    const realMarker = useRef<any | null>(null);
    const line = useRef<any | null>(null);
    const isMapInitialized = useRef(false);
    const submitGuessHandlerRef = useRef<(() => void) | null>(null);
    const lastHeadingRef = useRef(0);

    useEffect(() => {
        if (!matchId) {
            onOpenChampionships();
        }
    }, [matchId, onOpenChampionships]);

    const loadRoundsPlayed = useCallback(async () => {
        if (!session || !matchId) return;
        setLoadingRounds(true);
        try {
            const { count, error } = await supabase
                .from('match_guesses')
                .select('*', { count: 'exact', head: true })
                .eq('match_id', matchId)
                .eq('user_id', session.user.id);

            if (error) throw error;
            setMatchRoundsPlayed(count || 0);
        } catch (error: any) {
            console.error('Error in loadRoundsPlayed:', error);
            setErrorMsg('Error loading game rounds. Please reload the page.');
            setGameState('error');
        } finally {
            setLoadingRounds(false);
        }
    }, [session, matchId]);

    useEffect(() => {
        loadRoundsPlayed();
    }, [loadRoundsPlayed]);



    const handleSubmitGuess = useCallback(async () => {
        if (isSubmitting || !realLocation) return;
        setIsSubmitting(true);

        const currentRoundNum = matchId ? matchRoundsPlayed + 1 : roundsPlayedToday + 1;
        const roundKey = matchId
            ? `meroguessr-match-${matchId}-round-${currentRoundNum}`
            : `meroguessr-round-${session.user.id}-${currentRoundNum}`;

        localStorage.removeItem(roundKey);

        let dist: number | null = null;
        let finalScore = 0;
        let breakdown: ScoreBreakdown = { distance: 0, time: 0 };

        if (guessLocation) {
            dist = googleMapsService.calculateDistance(realLocation, guessLocation);

            if (dist <= 0.5) { // 500 meters
                finalScore = 100;
                breakdown = { distance: 90, time: 10 };
            } else {
                const maxDistance = 15000;
                const minDistance = 1;
                let distanceScore = 0;
                if (dist <= minDistance) {
                    distanceScore = 90;
                } else if (dist < maxDistance) {
                    distanceScore = 90 * (1 - (dist - minDistance) / (maxDistance - minDistance));
                }
                breakdown.distance = Math.max(0, distanceScore);
                breakdown.time = (Math.min(timeLeft, 60) / 60) * 10;
                finalScore = breakdown.distance + breakdown.time;
            }
        } else {
            // Time ran out or no guess made
            finalScore = 0;
            dist = null; // Ensure distance is null if no guess
            breakdown = { distance: 0, time: 0 };
        }

        finalScore = parseFloat(Math.min(100, finalScore).toFixed(2));
        setDistance(dist);
        setScore(finalScore);
        setScoreBreakdown({
            distance: parseFloat(breakdown.distance.toFixed(2)),
            time: parseFloat(breakdown.time.toFixed(2)),
        });

        try {
            const submittedGuessLocation = guessLocation ? { lat: guessLocation.lat(), lng: guessLocation.lng() } : null;

            if (matchId) {
                // Save match guess
                await supabase.from('match_guesses').insert({
                    match_id: matchId,
                    round_number: currentRoundNum,
                    user_id: session.user.id,
                    lat: submittedGuessLocation?.lat,
                    lng: submittedGuessLocation?.lng,
                    score: finalScore,
                    distance: dist
                });
                setMatchRoundsPlayed(prev => prev + 1);

                // Check if match finished for this user
                if (currentRoundNum === 6) {
                    // Trigger check completion
                    await supabase.rpc('trigger_match_completion', { p_match_id: matchId });
                }

            } else {
                await saveScore(session.user, finalScore, dist ?? 0, submittedGuessLocation, realLocation);
                setRoundsPlayedToday(prev => prev + 1);
            }

        } catch (e) {
            // Handle error saving score
            console.error("Error saving score", e);
        }

        if (realMarker.current) realMarker.current.setMap(null);

        realMarker.current = new google.maps.Marker({
            position: realLocation,
            map: mapInstance.current,
            title: "Ubicación Real",
            icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" },
        });

        if (guessLocation) {
            if (line.current) line.current.setMap(null);
            line.current = new google.maps.Polyline({
                path: [guessLocation, realLocation],
                geodesic: true,
                strokeColor: "#FF0000",
                strokeOpacity: 1.0,
                strokeWeight: 2,
                map: mapInstance.current,
            });

            const bounds = new google.maps.LatLngBounds();
            bounds.extend(realLocation);
            bounds.extend(guessLocation);
            mapInstance.current?.fitBounds(bounds, 50);
        } else {
            mapInstance.current?.setCenter(realLocation);
            mapInstance.current?.setZoom(3);
        }

        setGameState('result');
        setIsSubmitting(false);
    }, [realLocation, guessLocation, session.user, isSubmitting, timeLeft, roundsPlayedToday, matchId, matchRoundsPlayed]);


    useEffect(() => {
        submitGuessHandlerRef.current = handleSubmitGuess;
    });

    const loadGameLocation = useCallback(async () => {
        if (!matchId) return;

        try {
            if (matchRoundsPlayed >= 6) {
                setGameState('home');
                return;
            }

            const currentRoundNum = matchRoundsPlayed + 1;

            // Generate a new verified location first, as it might be needed.
            const newLocation = await googleMapsService.getRandomLocation();

            // Call the RPC function to either get the existing round or create a new one.
            const { data: roundData, error: rpcError } = await supabase.rpc('get_or_create_match_round', {
                p_match_id: matchId,
                p_round_number: currentRoundNum,
                p_lat: newLocation.lat,
                p_lng: newLocation.lng
            }).single();

            if (rpcError) throw rpcError;

            const locationForRound = roundData;

            setRealLocation(locationForRound);
            setGuessLocation(null);
            setDistance(null);
            setScore(null);
            setScoreBreakdown(null);

            if (guessMarker.current) guessMarker.current.setMap(null);
            if (realMarker.current) realMarker.current.setMap(null);
            if (line.current) line.current.setMap(null);

            if (panoramaInstance.current) {
                panoramaInstance.current.setPosition(locationForRound);
                panoramaInstance.current.setVisible(true);
            }

            if (mapInstance.current) {
                mapInstance.current.setCenter({ lat: 20, lng: 0 });
                mapInstance.current.setZoom(2);
            }

            setGameState('ready');
        } catch (error) {
            console.error("Error loading location:", error);
            setErrorMsg("Could not load the location for the game. Please try again.");
            setGameState('error');
        }
    }, [matchId, matchRoundsPlayed]);

    const initializeMaps = useCallback(async () => {
        if (isMapInitialized.current || !mapRef.current || !streetViewRef.current) return;

        try {
            const loaded = await googleMapsService.load();
            if (!loaded) {
                setGameState('error');
                setErrorMsg("Google Maps API Key is missing. Please ensure it is configured correctly.");
                return;
            }

            mapInstance.current = new google.maps.Map(mapRef.current, {
                center: { lat: 20, lng: 0 },
                zoom: 2,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                draggableCursor: 'crosshair',
                draggingCursor: 'grabbing',
                clickableIcons: false,
                disableDoubleClickZoom: true,
                gestureHandling: 'greedy',
                mapId: '3a3b32445c2f82e'
            });

            panoramaInstance.current = new google.maps.StreetViewPanorama(streetViewRef.current, {
                position: { lat: 0, lng: 0 },
                pov: { heading: 165, pitch: 0 },
                zoom: 1,
                addressControl: false,
                linksControl: false,
                panControl: false,
                zoomControl: false,
                clickToGo: false,
                enableCloseButton: false,
                fullscreenControl: false,
                motionTracking: false,
                motionTrackingControl: false,
                showRoadLabels: false,
                keyboardShortcuts: false,
            });

            if (streetViewRef.current) {
                const blockKeyboardEvents = (e: KeyboardEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                };
                streetViewRef.current.addEventListener('keydown', blockKeyboardEvents, true);
                streetViewRef.current.addEventListener('keyup', blockKeyboardEvents, true);
                streetViewRef.current.addEventListener('keypress', blockKeyboardEvents, true);
            }

            mapInstance.current.setStreetView(panoramaInstance.current);
            panoramaInstance.current.setVisible(false);

            panoramaInstance.current.addListener('pov_changed', () => {
                const currentPov = panoramaInstance.current.getPov();
                if (currentPov) {
                    const newHeading = currentPov.heading;
                    const lastHeading = lastHeadingRef.current;
                    let diff = newHeading - lastHeading;

                    if (diff > 180) diff -= 360;
                    else if (diff < -180) diff += 360;

                    setPov(prev => ({
                        heading: newHeading,
                        unwrappedHeading: prev.unwrappedHeading + diff,
                    }));
                    lastHeadingRef.current = newHeading;
                }
            });

            isMapInitialized.current = true;
        } catch (err) {
            setGameState('error');
            setErrorMsg("Failed to load Google Maps. The API key might be invalid, expired, or restricted. Please check the browser's developer console for an error like 'InvalidKeyMapError', then fix the issue and refresh the page.");
        }
    }, []);

    const handleStartGame = () => setGameState('loading');
    const handleNextRound = () => setGameState('loading');

    useEffect(() => {
        const initAndStart = async () => {
            if (gameState === 'loading') {
                if (!isMapInitialized.current) await initializeMaps();

                if (isMapInitialized.current) {
                    try {
                        await loadGameLocation();
                    } catch (error) {
                        setErrorMsg("Could not load the next location. Please try starting a new game.");
                        setGameState('error');
                    }
                }
            }
        };
        initAndStart();
    }, [gameState, initializeMaps, loadGameLocation]);

    useEffect(() => {
        if (gameState === 'playing') {
            const currentRoundNum = matchId ? matchRoundsPlayed + 1 : roundsPlayedToday + 1;
            const roundKey = matchId
                ? `meroguessr-match-${matchId}-round-${currentRoundNum}`
                : `meroguessr-round-${session.user.id}-${currentRoundNum}`;

            const startTimeStr = localStorage.getItem(roundKey);
            const startTime = startTimeStr ? parseInt(startTimeStr, 10) : Date.now();

            if (!startTimeStr) {
                localStorage.setItem(roundKey, startTime.toString());
            }

            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const initialTimeLeft = 90 - elapsedSeconds;

            if (initialTimeLeft <= 0) {
                setTimeLeft(0);
                if (submitGuessHandlerRef.current) {
                    submitGuessHandlerRef.current();
                }
                return; // No need to start a timer
            }

            setTimeLeft(initialTimeLeft);

            const timerId = setInterval(() => {
                setTimeLeft(prevTime => {
                    if (prevTime <= 1) {
                        clearInterval(timerId);
                        if (submitGuessHandlerRef.current) {
                            submitGuessHandlerRef.current();
                        }
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);

            return () => clearInterval(timerId);
        }
    }, [gameState, session.user.id, roundsPlayedToday, matchId, matchRoundsPlayed]);

    useEffect(() => {
        if (!mapInstance.current) return;

        const listener = mapInstance.current.addListener("click", (e: any) => {
            if (gameState !== 'playing' || !e.latLng) return;
            setGuessLocation(e.latLng);

            if (!guessMarker.current) {
                guessMarker.current = new google.maps.Marker({
                    position: e.latLng,
                    map: mapInstance.current,
                    title: "Tu elección",
                    icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" },
                });
            } else {
                guessMarker.current.setPosition(e.latLng);
                guessMarker.current.setMap(mapInstance.current);
            }
        });

        return () => { google.maps.event.removeListener(listener); };
    }, [gameState]);

    const handleRestart = () => {
        if (errorMsg?.toLowerCase().includes("api key")) {
            window.location.reload();
        } else if (gameState === 'error') {
            setGameState('home');
            setErrorMsg(null);
            loadRoundsPlayed();
        } else {
            handleNextRound();
        }
    };

    const renderModal = (title: string, children: React.ReactNode, titleColor: string = "text-blue-600") => (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
            <div className="bg-white text-gray-800 p-8 rounded-xl shadow-2xl text-center w-full max-w-sm">
                <h2 className={`text-3xl mb-4 font-bold ${titleColor}`}>{title}</h2>
                {children}
            </div>
        </div>
    );

    return (
        <div className="w-screen h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
            <AdPopup isActive={gameState === 'playing'} />

            {gameState !== 'home' && (
                <main className={`flex-grow flex flex-col lg:flex-row transition-all duration-500 ease-in-out ${gameState === 'ready' ? 'blur-lg' : ''}`}>
                    <div className="relative w-full h-1/2 lg:h-full lg:w-1/2">
                        <div id="street-view" ref={streetViewRef} className="w-full h-full" tabIndex={-1} />
                        {gameState === 'playing' && <Compass unwrappedHeading={pov.unwrappedHeading} heading={pov.heading} />}
                    </div>
                    <div id="map" ref={mapRef} className="w-full h-1/2 lg:h-full lg:w-1/2" />
                </main>
            )}

            {gameState === 'home' && (
                <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-20 p-4">
                    <div className="text-center text-white w-full max-w-xl">
                        <h1 className="text-6xl lg:text-8xl font-bold mb-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.7)]">MeroGuessr</h1>
                        {loadingRounds ? (
                            <div className="border-4 border-gray-200 border-t-blue-600 rounded-full w-8 h-8 animate-spin mx-auto my-6" aria-label="Loading rounds"></div>
                        ) : (
                            matchId ? (
                                <div className="mt-8">
                                    <h2 className="text-3xl font-bold text-blue-400 mb-2">Championship Match</h2>
                                    {matchRoundsPlayed >= 6 ? (
                                        <div>
                                            <p className="text-xl mb-6 text-gray-300">You have completed this match!</p>
                                            <button onClick={onMatchExit} className="bg-gray-600 text-white font-medium py-3 px-6 rounded-lg cursor-pointer transition-all shadow-md hover:bg-gray-700 hover:shadow-lg">
                                                Back to Championships
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-xl mb-6 text-gray-300">Round {matchRoundsPlayed + 1} of 6</p>
                                            <button
                                                onClick={handleStartGame}
                                                className="bg-blue-600 text-white font-bold py-4 px-12 rounded-lg cursor-pointer transition-all duration-300 shadow-xl hover:bg-blue-700 hover:scale-105 hover:shadow-2xl text-2xl"
                                            >
                                                Start Round
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                roundsPlayedToday >= 5 ? (
                                    <div className="mt-8">
                                        <h2 className="text-3xl font-bold text-blue-400 mb-2">¡Bien Hecho!</h2>
                                        <p className="text-xl mb-6 text-gray-300">Has completado todas tus rondas por hoy. Vuelve mañana para más.</p>
                                        <RankingsDisplay user={session.user} />
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-2xl mb-8">
                                            {Math.max(0, 5 - roundsPlayedToday)} / 5 rounds remaining today
                                        </p>
                                        <button
                                            onClick={handleStartGame}
                                            className="bg-blue-600 text-white font-bold py-4 px-12 rounded-lg cursor-pointer transition-all duration-300 shadow-xl hover:bg-blue-700 hover:scale-105 hover:shadow-2xl text-2xl"
                                        >
                                            Start Game
                                        </button>
                                    </>
                                )
                            )
                        )}
                    </div>
                </div>
            )}


            {gameState === 'loading' && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[60]">
                    <div className="border-8 border-gray-200 border-t-blue-600 rounded-full w-16 h-16 animate-spin" aria-label="Cargando"></div>
                </div>
            )}

            {gameState === 'ready' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
                    <div className="text-center">
                        <h1 className="text-6xl lg:text-8xl font-bold text-white mb-8 drop-shadow-[0_4px_4px_rgba(0,0,0,0.7)]">MeroGuessr</h1>
                        <button
                            onClick={() => setGameState('playing')}
                            className="bg-blue-600 text-white font-bold py-4 px-12 rounded-lg cursor-pointer transition-all duration-300 shadow-xl hover:bg-blue-700 hover:scale-105 hover:shadow-2xl text-2xl"
                        >
                            Comenzar
                        </button>
                    </div>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-black bg-opacity-50 text-white text-3xl font-mono p-2 px-4 rounded-lg shadow-lg">
                    {formatTime(timeLeft)}
                </div>
            )}

            {gameState === 'playing' && guessLocation && (
                <button
                    onClick={handleSubmitGuess}
                    disabled={isSubmitting}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white font-bold py-3 px-8 rounded-full cursor-pointer transition-all shadow-lg hover:bg-blue-700 hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:animate-none"
                >
                    {isSubmitting ? 'Calculando...' : 'Confirmar Ubicación'}
                </button>
            )}

            {gameState === 'result' && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 lg:left-1/4 -translate-y-1/2 z-40 p-4">
                    <div className="bg-white text-gray-800 p-8 rounded-xl shadow-2xl text-center w-full max-w-sm">
                        <h2 className="text-3xl mb-4 font-bold text-blue-600">¡Resultado!</h2>

                        {distance !== null ? <p className="text-lg mb-2">Distancia: <strong className="font-bold">{distance.toFixed(2)} km</strong></p> : <p className="text-lg mb-2">Se acabó el tiempo. ¡Sin selección!</p>}

                        {scoreBreakdown && (
                            <div className="text-left w-full my-4 space-y-2 text-gray-700">
                                <h3 className="font-bold text-center text-lg mb-2">Desglose de Puntos</h3>
                                <div className="flex justify-between items-center border-b pb-1">
                                    <span>Bonificación de Tiempo</span>
                                    <span className="font-bold">{scoreBreakdown.time.toFixed(2)} / 10.00 pts</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-1">
                                    <span>Puntos por Distancia</span>
                                    <span className="font-bold">{scoreBreakdown.distance.toFixed(2)} / 90.00 pts</span>
                                </div>
                            </div>
                        )}

                        {score !== null && <p className="text-2xl font-bold mt-4 pt-4 border-t border-gray-200" style={{ color: `rgb(${(100 - (score ?? 0)) * 2.55}, ${(score ?? 0) * 2.55}, 0)` }}>Puntaje Total: {score} pts</p>}

                        <div className="mt-6">
                            {matchId ? (
                                matchRoundsPlayed < 6 ? (
                                    <button onClick={handleNextRound} className="bg-blue-600 text-white font-medium py-3 px-6 rounded-lg cursor-pointer transition-all shadow-md hover:bg-blue-700 hover:shadow-lg">
                                        Next Match Round
                                    </button>
                                ) : (
                                    <button onClick={onMatchExit} className="bg-gray-600 text-white font-medium py-3 px-6 rounded-lg cursor-pointer transition-all shadow-md hover:bg-gray-700 hover:shadow-lg">
                                        Finish Match
                                    </button>
                                )
                            ) : (
                                roundsPlayedToday < 5 ? (
                                    <button onClick={handleNextRound} className="bg-blue-600 text-white font-medium py-3 px-6 rounded-lg cursor-pointer transition-all shadow-md hover:bg-blue-700 hover:shadow-lg">
                                        Siguiente Ronda
                                    </button>
                                ) : (
                                    <>
                                        <p className="text-lg mb-4 text-gray-600">You've played all your rounds for today!</p>
                                        <button onClick={() => setGameState('home')} className="bg-gray-600 text-white font-medium py-3 px-6 rounded-lg cursor-pointer transition-all shadow-md hover:bg-gray-700 hover:shadow-lg">
                                            Back to Home
                                        </button>
                                    </>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            {gameState === 'error' && renderModal("An Error Occurred",
                <>
                    <p className="text-base mb-6 text-gray-600 px-4">{errorMsg}</p>
                    <button onClick={handleRestart} className="bg-blue-600 text-white font-medium py-3 px-6 rounded-lg cursor-pointer transition-all shadow-md hover:bg-blue-700 hover:shadow-lg">
                        {errorMsg?.toLowerCase().includes("api key") ? "Refresh Page" : "Try Again"}
                    </button>
                </>,
                "text-red-500"
            )}
        </div>
    );
};

export default MeroGuessr;