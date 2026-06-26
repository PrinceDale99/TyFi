import React, { useState } from 'react';
import { CheckCircle, Clock, Shield } from 'lucide-react';

export const AdminActionQueue: React.FC = () => {
    // Mock state for multi-sig queue
    const [signatures, setSignatures] = useState(2);
    const requiredSignatures = 3;

    return (
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-white mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    Administrative Action Queue
                </h3>
                <span className="text-sm font-mono bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">
                    {signatures} / {requiredSignatures} Signatures
                </span>
            </div>

            <div className="space-y-4">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className="font-medium text-slate-200">Adjust Payout Threshold</h4>
                            <p className="text-sm text-slate-400">Target Region: Luzon</p>
                        </div>
                        <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">Pending Execution</span>
                    </div>

                    {/* Signatory Manifest */}
                    <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">Red Cross Node</span>
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">UNICEF Treasury</span>
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">Local Gov Node</span>
                            <Clock className="w-4 h-4 text-slate-500" />
                        </div>
                    </div>

                    <div className="mt-5">
                        <button
                            disabled={signatures < requiredSignatures}
                            className={`w-full py-2 rounded-lg font-medium transition-colors ${
                                signatures >= requiredSignatures 
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {signatures >= requiredSignatures ? 'Execute Transaction' : 'Waiting for Quorum'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
