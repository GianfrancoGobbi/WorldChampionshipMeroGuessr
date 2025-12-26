import React, { useState, useEffect, useRef } from 'react';

const ads = [
    { id: 1, title: "Maduras Gratis", body: "A un click de distancia. No dejes pasar la oportunidad." },
    { id: 2, title: "¡Recordatorio Amistoso!", body: "Carga tus tareas, no seas botón. El equipo te lo agradecerá." },
    { id: 3, title: "Ratatuille Viandas", body: "Comida casera, directo a tu oficina. ¡El sabor que te mereces!" },
];

interface AdPopupProps {
    isActive: boolean;
}

const AdPopup: React.FC<AdPopupProps> = ({ isActive }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentAd, setCurrentAd] = useState(ads[0]);
    // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const clearTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
        
        const scheduleNextAd = () => {
            clearTimer();
            const randomDelay = Math.random() * (40000 - 30000) + 30000; // 30-40 seconds
            timerRef.current = setTimeout(showRandomAd, randomDelay);
        };

        const showRandomAd = () => {
            const randomIndex = Math.floor(Math.random() * ads.length);
            setCurrentAd(ads[randomIndex]);
            setIsVisible(true);

            // Hide the ad after 7 seconds
            const hideTimer = setTimeout(() => {
                setIsVisible(false);
                // Schedule the next ad to appear
                scheduleNextAd();
            }, 7000);
            
            // This is just to ensure we don't stack timers if component logic changes
            return () => clearTimeout(hideTimer);
        };

        if (isActive) {
            scheduleNextAd();
        } else {
            clearTimer();
            setIsVisible(false);
        }

        return clearTimer;
    }, [isActive]);

    const handleClose = () => {
        setIsVisible(false);
         if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        // Schedule the next one as if it had disappeared naturally
        const randomDelay = Math.random() * (40000 - 30000) + 30000;
        timerRef.current = setTimeout(() => {
             const randomIndex = Math.floor(Math.random() * ads.length);
            setCurrentAd(ads[randomIndex]);
            setIsVisible(true);
        }, randomDelay);
    };

    return (
        <div 
            className={`hidden md:block fixed bottom-5 right-5 w-72 bg-white rounded-lg shadow-2xl text-gray-800 p-4 transform transition-all duration-500 ease-in-out z-[99] ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
            role="alert"
            aria-live="polite"
        >
            <button 
                onClick={handleClose} 
                className="absolute top-1 right-2 text-gray-400 hover:text-gray-800 text-2xl font-bold"
                aria-label="Cerrar anuncio"
            >
                &times;
            </button>
            <h4 className="font-bold text-lg mb-1">{currentAd.title}</h4>
            <p className="text-sm">{currentAd.body}</p>
        </div>
    );
};

export default AdPopup;