import React from 'react';

const directions = [
    { deg: 0, label: 'N' }, { deg: 45, label: 'NE' }, { deg: 90, label: 'E' },
    { deg: 135, label: 'SE' }, { deg: 180, label: 'S' }, { deg: 225, label: 'SW' },
    { deg: 270, label: 'W' }, { deg: 315, label: 'NW' }
];

const Ticks = React.memo(() => {
    const pixelsPerDegree = 4;
    const ticks = [];
    for (let i = 0; i < 360; i += 2) {
        const isMajor = i % 10 === 0;
        const isLabel = i % 30 === 0;
        const dir = directions.find(d => d.deg === i);

        ticks.push(
            <div 
                key={i} 
                className="absolute h-full"
                style={{ left: `${i * pixelsPerDegree}px` }}
            >
                <div className={`absolute bottom-0 w-px ${isMajor ? 'h-4 bg-white' : 'h-2 bg-gray-400'}`}></div>
                {dir ? (
                    <span className={`absolute bottom-5 -translate-x-1/2 text-lg font-bold ${dir.label.length === 1 ? 'text-white' : 'text-gray-300'}`}>
                        {dir.label}
                    </span>
                ) : isLabel && i !== 0 && (
                    <span className="absolute bottom-5 -translate-x-1/2 text-sm text-gray-400">
                        {i}
                    </span>
                )}
            </div>
        );
    }
    return <>{ticks}</>;
});


const Compass: React.FC<{ unwrappedHeading: number; heading: number }> = ({ unwrappedHeading, heading }) => {
    const pixelsPerDegree = 4;
    const viewWidth = 300;
    const tapeWidth = 360 * pixelsPerDegree;

    const transformX = - (unwrappedHeading * pixelsPerDegree) + (viewWidth / 2);

    return (
        <div className={`absolute top-5 left-1/2 -translate-x-1/2 w-[300px] h-16 bg-black bg-opacity-40 rounded-lg overflow-hidden select-none pointer-events-none z-30`}>
            {/* Compass Tape container */}
            <div 
                className="relative h-full"
                style={{ 
                    transform: `translateX(${transformX}px)`,
                    willChange: 'transform',
                }}
            >
                {/* Render three tapes to ensure it's always filled, centered at 0 */}
                <div className="absolute top-0 h-full" style={{ left: `${-tapeWidth}px`, width: `${tapeWidth}px` }}><Ticks /></div>
                <div className="absolute top-0 h-full" style={{ left: `0px`, width: `${tapeWidth}px` }}><Ticks /></div>
                <div className="absolute top-0 h-full" style={{ left: `${tapeWidth}px`, width: `${tapeWidth}px` }}><Ticks /></div>
            </div>
            
            {/* Center Marker */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full flex flex-col items-center">
                <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-red-500"></div>
            </div>
            <div className="absolute top-8 left-1/2 -translate-x-1/2 text-white font-mono text-sm bg-black/50 px-2 py-0.5 rounded">
                {Math.round(heading)}°
            </div>
        </div>
    );
};

export default Compass;
