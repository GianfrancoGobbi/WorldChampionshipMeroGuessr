import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Session } from '@supabase/supabase-js';
import { googleMapsService } from '../services/googleMapsService';

declare const google: any;

interface GameMode {
    id: string;
    name: string;
    description: string;
    created_at: string;
}

interface GameModeLocation {
    id: string;
    game_mode_id: string;
    lat: number;
    lng: number;
    radius: number;
}

const CustomModes: React.FC<{ session: Session }> = ({ session }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [modes, setModes] = useState<GameMode[]>([]);
    const [view, setView] = useState<'list' | 'builder'>('list');
    const [currentMode, setCurrentMode] = useState<GameMode | null>(null);
    const [locations, setLocations] = useState<GameModeLocation[]>([]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [mapsUrl, setMapsUrl] = useState('');

    // Map refs
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const circleObjects = useRef<{ [key: string]: any }>({});
    const markerObjects = useRef<{ [key: string]: any }>({});

    const isAllowedUser = session?.user?.email === 'ggobbi@merovingiandata.com';

    useEffect(() => {
        fetchModes();
    }, []);

    useEffect(() => {
        if (id && id !== 'new') {
            // Edit mode - also restrict if needed, but let's stick to restricting creation/builder access for 'new'
            // If the user wants to strictly restrict creation, we definitely need to block 'new'
            // If we assume this user is the ONLY one who manages modes, we should block edit too.
            // Let's block both Edit and Create for now as per "only user X" implication of ownership.
            if (!isAllowedUser) {
                alert('You are not authorized to edit game modes.');
                navigate('/custom-modes');
                return;
            }
            fetchModeDetails(id);
        } else if (id === 'new') {
            if (!isAllowedUser) {
                alert('You are not authorized to create new game modes.');
                navigate('/custom-modes');
                return;
            }
            setView('builder');
            setCurrentMode(null);
            setName('');
            setDescription('');
            setLocations([]);
        } else {
            setView('list');
            setCurrentMode(null);
        }
    }, [id, isAllowedUser]); // Added isAllowedUser ref

    const fetchModes = async () => {
        const { data } = await supabase.from('game_modes').select('*').order('created_at', { ascending: false });
        if (data) setModes(data);
    };

    const fetchModeDetails = async (modeId: string) => {
        const { data: modeData } = await supabase.from('game_modes').select('*').eq('id', modeId).single();
        const { data: locData } = await supabase.from('game_mode_locations').select('*').eq('game_mode_id', modeId);

        if (modeData) {
            setCurrentMode(modeData);
            setName(modeData.name);
            setDescription(modeData.description);
            setLocations(locData || []);
            setView('builder');
        }
    };

    useEffect(() => {
        if (view === 'builder' && mapRef.current && !mapInstance.current) {
            initMap();
        }
    }, [view]);

    useEffect(() => {
        if (mapInstance.current) {
            updateMapCircles();
        }
    }, [locations]);

    const initMap = async () => {
        await googleMapsService.load();
        mapInstance.current = new google.maps.Map(mapRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
            mapId: 'BUILDER_MAP'
        });

        mapInstance.current.addListener('click', (e: any) => {
            const newLoc = {
                id: Math.random().toString(), // Temp ID
                game_mode_id: id || '',
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
                radius: 50000 // Default 50km
            };
            setLocations(prev => [...prev, newLoc]);
        });
    };

    const updateMapCircles = () => {
        const currentIds = new Set(locations.map(l => l.id));

        // 1. Remove old objects
        Object.keys(circleObjects.current).forEach(id => {
            if (!currentIds.has(id)) {
                circleObjects.current[id].setMap(null);
                markerObjects.current[id].setMap(null);
                delete circleObjects.current[id];
                delete markerObjects.current[id];
            }
        });

        // 2. Add or Update objects
        locations.forEach((loc) => {
            if (!circleObjects.current[loc.id]) {
                // Create new circle
                const circle = new google.maps.Circle({
                    strokeColor: "#3B82F6",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#3B82F6",
                    fillOpacity: 0.35,
                    map: mapInstance.current,
                    center: { lat: loc.lat, lng: loc.lng },
                    radius: loc.radius,
                    editable: true,
                    draggable: false // Drag from marker instead
                });

                // Create center marker for dragging
                const marker = new google.maps.Marker({
                    position: { lat: loc.lat, lng: loc.lng },
                    map: mapInstance.current,
                    draggable: true,
                    title: "Drag to move"
                });

                circle.addListener('radius_changed', () => {
                    const newRadius = circle.getRadius();
                    setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, radius: newRadius } : l));
                });

                marker.addListener('drag', () => {
                    const pos = marker.getPosition();
                    circle.setCenter(pos);
                });

                marker.addListener('dragend', () => {
                    const pos = marker.getPosition();
                    setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, lat: pos.lat(), lng: pos.lng() } : l));
                });

                circleObjects.current[loc.id] = circle;
                markerObjects.current[loc.id] = marker;
            } else {
                // Update existing (only if changed from external source)
                const circle = circleObjects.current[loc.id];
                const marker = markerObjects.current[loc.id];

                const currentCenter = circle.getCenter();
                if (Math.abs(currentCenter.lat() - loc.lat) > 0.0001 || Math.abs(currentCenter.lng() - loc.lng) > 0.0001) {
                    circle.setCenter({ lat: loc.lat, lng: loc.lng });
                    marker.setPosition({ lat: loc.lat, lng: loc.lng });
                }

                if (Math.abs(circle.getRadius() - loc.radius) > 1) {
                    circle.setRadius(loc.radius);
                }
            }
        });
    };

    const handleSave = async () => {
        if (!isAllowedUser) {
            alert('Unauthorized');
            return;
        }
        if (!name) return alert('Name is required');

        let modeId = id && id !== 'new' ? id : null;
        if (!modeId) {
            const { data, error } = await supabase.from('game_modes').insert({
                name,
                description,
                created_by: session.user.id
            }).select().single();
            if (error) return alert(error.message);
            modeId = data.id;
        } else {
            await supabase.from('game_modes').update({ name, description }).eq('id', modeId);
        }

        // Handle locations
        // Easiest is to delete and re-insert for now
        await supabase.from('game_mode_locations').delete().eq('game_mode_id', modeId);
        const locsToInsert = locations.map(l => ({
            game_mode_id: modeId,
            lat: l.lat,
            lng: l.lng,
            radius: l.radius
        }));

        if (locsToInsert.length > 0) {
            await supabase.from('game_mode_locations').insert(locsToInsert);
        }

        alert('Mode saved!');
        navigate('/custom-modes');
        fetchModes();
    };

    const handleDeleteMode = async (modeId: string) => {
        if (!isAllowedUser) return alert('Unauthorized');
        if (!window.confirm('Are you sure?')) return;
        await supabase.from('game_modes').delete().eq('id', modeId);
        fetchModes();
    };

    const extractCoords = (url: string) => {
        // Try @lat,lng,ZOOMm format (where m is scale in meters)
        const regexScale = /@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)([ma])/;
        const matchScale = url.match(regexScale);

        // Try to extract place name
        const nameRegex = /maps\/place\/([^/@?]+)/;
        const nameMatch = url.match(nameRegex);
        const name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')) : null;

        if (matchScale) {
            const scale = parseFloat(matchScale[3]);
            // If scale is in 'm' (meters), use it as diameter/radius
            // If it's something else, default to 1000m
            const radius = matchScale[4] === 'm' ? scale / 1.5 : 50000;
            return { lat: parseFloat(matchScale[1]), lng: parseFloat(matchScale[2]), radius, name };
        }

        const regexSimple = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const matchSimple = url.match(regexSimple);
        if (matchSimple) return { lat: parseFloat(matchSimple[1]), lng: parseFloat(matchSimple[2]), radius: 50000, name };

        // Try simple lat,lng
        const parts = url.split(',');
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, radius: 50000, name: null };
        }
        return null;
    };

    const handleGoToUrl = () => {
        const coords = extractCoords(mapsUrl);
        if (coords && mapInstance.current) {
            mapInstance.current.setCenter(coords);
            mapInstance.current.setZoom(15);
            setMapsUrl('');
        } else {
            alert('Could not parse coordinates from URL. Make sure it contains @lat,lng');
        }
    };

    const handleAddFromUrl = () => {
        const info = extractCoords(mapsUrl);
        if (info) {
            const newLoc = {
                id: Math.random().toString(),
                game_mode_id: id || '',
                lat: info.lat,
                lng: info.lng,
                radius: info.radius
            };
            setLocations(prev => [...prev, newLoc]);
            if (mapInstance.current) {
                mapInstance.current.setCenter({ lat: info.lat, lng: info.lng });
                // Calculate appropriate zoom based on radius
                const zoom = Math.round(14 - Math.log2(info.radius / 500));
                mapInstance.current.setZoom(Math.max(1, Math.min(20, zoom)));
            }
            setMapsUrl('');
        } else {
            alert('Could not parse coordinates or area from URL.');
        }
    };

    return (
        <div className="h-full bg-gray-900 text-white p-8 pl-20 overflow-y-auto">
            <div className="flex items-center gap-4 mb-8">
                {view === 'builder' && (
                    <Link to="/custom-modes" className="text-blue-400 hover:underline">Back to List</Link>
                )}
                <h1 className="text-4xl font-bold">Custom Modes Builder</h1>
            </div>

            {view === 'list' ? (
                <div>
                    {isAllowedUser && (
                        <button
                            onClick={() => navigate('/custom-modes/new')}
                            className="bg-green-600 px-6 py-3 rounded mb-6 font-bold hover:bg-green-700 transition-all"
                        >
                            Create New Mode
                        </button>
                    )}
                    <div className="grid gap-4">
                        {modes.map(m => (
                            <div key={m.id} className="bg-gray-800 p-6 rounded border border-gray-700 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold">{m.name}</h2>
                                    <p className="text-gray-400">{m.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => navigate(`/test/${m.id}`)} className="bg-green-600 px-4 py-2 rounded hover:bg-green-700">Test</button>
                                    {isAllowedUser && (
                                        <>
                                            <button onClick={() => navigate(`/custom-modes/${m.id}`)} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">Edit</button>
                                            <button onClick={() => handleDeleteMode(m.id)} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700">Delete</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid lg:grid-cols-3 gap-8 h-[calc(100vh-200px)]">
                    <div className="lg:col-span-1 bg-gray-800 p-6 rounded border border-gray-700 overflow-y-auto">
                        <div className="mb-4">
                            <label className="block text-gray-400 mb-1">Mode Name</label>
                            <input
                                className="w-full bg-gray-700 p-2 rounded text-white"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-400 mb-1">Description</label>
                            <textarea
                                className="w-full bg-gray-700 p-2 rounded text-white"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="mb-6 border-t border-gray-700 pt-6">
                            <label className="block text-gray-400 mb-1">Quick Navigate (Google Maps URL)</label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-gray-700 p-2 rounded text-white text-sm"
                                    placeholder="Paste URL here..."
                                    value={mapsUrl}
                                    onChange={e => setMapsUrl(e.target.value)}
                                />
                                <button
                                    onClick={handleGoToUrl}
                                    className="bg-gray-600 px-3 py-2 rounded text-sm hover:bg-gray-500"
                                    title="Go to location"
                                >
                                    Go
                                </button>
                                <button
                                    onClick={handleAddFromUrl}
                                    className="bg-green-600 px-3 py-2 rounded text-sm hover:bg-green-500"
                                    title="Add region here"
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="font-bold mb-2">Locations ({locations.length})</h3>
                            <p className="text-sm text-gray-400 mb-4">Click on the map to add a region. Points will be generated randomly inside these circles.</p>
                            <div className="space-y-2">
                                {locations.map((loc, i) => (
                                    <div key={loc.id} className="bg-gray-900 p-3 rounded flex justify-between items-center text-sm">
                                        <span>Region {i + 1} ({(loc.radius / 1000).toFixed(1)}km)</span>
                                        <button
                                            onClick={() => setLocations(prev => prev.filter((_, idx) => idx !== i))}
                                            className="text-red-500 hover:text-red-400"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={handleSave}
                                className="flex-1 bg-blue-600 py-3 rounded font-bold hover:bg-blue-700"
                            >
                                Save Game Mode
                            </button>
                            {id && id !== 'new' && (
                                <button
                                    onClick={() => navigate(`/test/${id}`)}
                                    className="flex-1 bg-green-600 py-3 rounded font-bold hover:bg-green-700"
                                >
                                    Test Now
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="lg:col-span-2 relative rounded overflow-hidden border border-gray-700">
                        <div ref={mapRef} className="w-full h-full" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomModes;
