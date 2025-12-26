import React, { useEffect, useRef, useState } from 'react';
import type { User } from "@supabase/supabase-js";
import { fetchGuessesForLocation } from '../services/supabaseService';
import { googleMapsService } from '../services/googleMapsService';
import { MAP_ID } from '../constants/google';
import type { PlayedRound, PlayerGuess } from '../types';

declare const google: any;

interface LocationDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundData: PlayedRound;
    user: User;
}

const LocationDetailModal: React.FC<LocationDetailModalProps> = ({ isOpen, onClose, roundData, user }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const markersRef = useRef<any[]>([]);
    const polylineRef = useRef<any | null>(null);

    const [otherGuesses, setOtherGuesses] = useState<PlayerGuess[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initMap = async () => {
            if (isOpen && mapRef.current && !mapInstance.current) {
                try {
                    const loaded = await googleMapsService.load();
                    if (!loaded) {
                        setError("Failed to load map services.");
                        return;
                    }
                    mapInstance.current = new google.maps.Map(mapRef.current, {
                        center: { lat: 20, lng: 0 },
                        zoom: 2,
                        streetViewControl: false,
                        mapTypeControl: false, // We want maximum space
                        fullscreenControl: false,
                        clickableIcons: false,
                        gestureHandling: 'greedy',
                        mapId: MAP_ID,
                        zoomControl: true, // Enable zoom control for easier navigation on full screen
                        zoomControlOptions: {
                            position: google.maps.ControlPosition.RIGHT_CENTER
                        }
                    });
                    setIsMapReady(true);
                } catch (err) {
                    setError("Failed to load Google Maps. The API key might be invalid or missing.");
                    console.error(err);
                }
            }
        };
        
        initMap();

        if (!isOpen) {
            setIsMapReady(false);
            mapInstance.current = null;
        }

    }, [isOpen]);

    useEffect(() => {
        const loadGuesses = async () => {
            if (isOpen && roundData?.location && user?.id) {
                setLoading(true);
                setError(null);
                try {
                    const guesses = await fetchGuessesForLocation(roundData.location, user.id);
                    setOtherGuesses(guesses);
                } catch (e: any) {
                    setError(e.message);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadGuesses();
    }, [isOpen, roundData, user]);
    
    useEffect(() => {
        if (isOpen && isMapReady && mapInstance.current && roundData) {
            // Clear previous markers/lines
            markersRef.current.forEach(marker => {
                if (marker.setMap) marker.setMap(null); // For old markers
                else marker.map = null; // For new advanced markers
            });
            markersRef.current = [];
            if (polylineRef.current) {
                polylineRef.current.setMap(null);
                polylineRef.current = null;
            }
            
            const realLocation = roundData.location;
            const userGuess = roundData.guessed_location;

            const bounds = new google.maps.LatLngBounds();

            // Real location marker (red)
            const realMarker = new google.maps.Marker({
                position: realLocation,
                map: mapInstance.current,
                title: "Ubicación Real",
                icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" },
            });
            markersRef.current.push(realMarker);
            bounds.extend(realLocation);
            
            // User guess marker (blue)
            if (userGuess) {
                const userMarker = new google.maps.Marker({
                    position: userGuess,
                    map: mapInstance.current,
                    title: "Tu elección",
                    icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" },
                });
                markersRef.current.push(userMarker);
                bounds.extend(userGuess);

                // Line between user guess and real location
                polylineRef.current = new google.maps.Polyline({
                    path: [userGuess, realLocation],
                    geodesic: true,
                    strokeColor: "#FF0000",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                    map: mapInstance.current,
                });
            }

            // Other players' guesses (purple) with permanent labels
            otherGuesses.forEach(guess => {
                if (guess.guessed_location && guess.profiles.username) {
                    const markerContent = document.createElement('div');
                    markerContent.className = 'relative';

                    const contentInner = document.createElement('div');
                    contentInner.className = 'absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center group'; // Added group for potential hover effects
                    markerContent.appendChild(contentInner);

                    const nameLabel = document.createElement('div');
                    nameLabel.textContent = guess.profiles.username;
                    // Increased z-index and styling for visibility on full screen
                    nameLabel.className = 'bg-black bg-opacity-80 text-white text-sm font-bold px-3 py-1 rounded-lg shadow-xl whitespace-nowrap mb-1 border border-gray-600';
                    contentInner.appendChild(nameLabel);

                    const iconImg = document.createElement('img');
                    iconImg.src = "http://maps.google.com/mapfiles/ms/icons/purple-dot.png";
                    iconImg.className = "w-8 h-8 drop-shadow-lg transform transition-transform hover:scale-125";
                    contentInner.appendChild(iconImg);

                    const marker = new google.maps.marker.AdvancedMarkerElement({
                        position: guess.guessed_location,
                        map: mapInstance.current,
                        content: markerContent,
                        title: guess.profiles.username,
                    });
                    markersRef.current.push(marker);
                    bounds.extend(guess.guessed_location);
                }
            });

            if (!bounds.isEmpty()) {
                 mapInstance.current.fitBounds(bounds, 50);
            } else {
                mapInstance.current.setCenter(realLocation);
                mapInstance.current.setZoom(3);
            }
        }
    }, [isOpen, isMapReady, roundData, otherGuesses]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-gray-900" onClick={(e) => e.stopPropagation()}>
            {/* Full Screen Map Container */}
            <div className="relative w-full h-full">
                
                {/* Floating Header - Top Left */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="bg-gray-900 bg-opacity-90 backdrop-blur-md text-white px-5 py-3 rounded-xl shadow-2xl border border-gray-700 pointer-events-auto">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span>🌍</span> Resumen de la Ronda
                        </h2>
                    </div>
                </div>

                {/* Floating Close Button - Top Right */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 z-10 bg-red-600 hover:bg-red-700 text-white rounded-full p-3 shadow-2xl transition-transform hover:scale-110 pointer-events-auto border-2 border-white/20"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* The Map */}
                <div id="map-detail" ref={mapRef} className="w-full h-full" />

                {/* Loading Overlay */}
                {loading && (
                     <div className="absolute inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-20">
                        <div className="bg-black bg-opacity-80 px-8 py-6 rounded-2xl text-white font-bold text-lg shadow-2xl border border-gray-700 flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            Cargando oponentes...
                        </div>
                     </div>
                )}

                {/* Error Overlay */}
                {error && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                        <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl border border-red-400 pointer-events-auto max-w-md text-center">
                            <p className="font-bold">Error</p>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationDetailModal;