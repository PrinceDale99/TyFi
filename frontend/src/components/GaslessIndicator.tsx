import React, { useState } from 'react';
import { Infinity, ShieldCheck } from 'lucide-react';

export const GaslessIndicator: React.FC = () => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <div 
                className="relative flex items-center bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 rounded-full px-4 py-2 shadow-lg shadow-emerald-900/20 cursor-help transition-all duration-300 hover:border-emerald-500/60"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2" />
                <span className="text-sm font-medium text-emerald-100 mr-2">Secured by Hardware Passkey</span>
                <div className="w-px h-4 bg-slate-700 mx-2"></div>
                <Infinity className="w-5 h-5 text-emerald-400 mr-1" />
                <span className="text-sm font-medium text-emerald-100">0 Fee</span>

                {/* Tooltip Expansion */}
                <div 
                    className={`absolute bottom-full right-0 mb-3 w-72 bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-2xl transition-all duration-200 origin-bottom-right ${
                        isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                >
                    <p className="text-sm text-slate-300 leading-relaxed">
                        <strong className="text-white block mb-1">100% Sponsor-Funded Network</strong>
                        Your identity is secured directly by your device's biometric chip. All network processing fees are covered by the platform treasury. You will never need to handle cryptocurrency to manage your policy.
                    </p>
                    <div className="absolute -bottom-2 right-8 w-4 h-4 bg-slate-800 border-b border-r border-slate-700 transform rotate-45"></div>
                </div>
            </div>
        </div>
    );
};
