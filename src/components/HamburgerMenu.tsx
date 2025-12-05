import React from 'react';
import type { Session } from "@supabase/supabase-js";

interface HamburgerMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenRankings: () => void;
    onOpenChampionships: () => void;
    onSignOut: () => void;
    session: Session;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, onClose, onOpenRankings, onOpenChampionships, onSignOut, session }) => {
    return (
        <>
            <div className={`fixed inset-0 bg-black z-[51] transition-opacity duration-300 ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 left-0 h-full bg-gray-800 text-white w-72 shadow-2xl z-[52] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6">
                    <div className="flex flex-col items-start mb-8">
                        <span className="text-lg font-bold">MeroGuessr</span>
                        <span className="text-sm text-gray-400 break-all">{session.user.email}</span>
                    </div>
                    <nav className="flex flex-col space-y-2">
                        <button onClick={onOpenRankings} className="text-left w-full text-lg hover:bg-gray-700 p-3 rounded-lg transition-colors">
                            Rankings
                        </button>
                        <button onClick={onOpenChampionships} className="text-left w-full text-lg hover:bg-gray-700 p-3 rounded-lg transition-colors">
                            Championships
                        </button>
                    </nav>
                </div>
                <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-700">
                    <button onClick={onSignOut} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-all duration-300 hover:bg-red-700">
                        Logout
                    </button>
                </div>
            </div>
        </>
    );
};

export default HamburgerMenu;
