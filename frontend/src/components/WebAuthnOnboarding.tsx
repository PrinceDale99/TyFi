import React, { useState } from 'react';
import { Fingerprint, Loader2, CheckCircle2, Lock } from 'lucide-react';

export const WebAuthnOnboarding: React.FC = () => {
    const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

    const handleCreatePasskey = async () => {
        setStep(1);
        
        // Mocking hardware WebAuthn pop-up delay
        setTimeout(() => {
            setStep(2);
            // Mocking Relayer Sponsorship delay
            setTimeout(() => {
                setStep(3);
            }, 2500);
        }, 2000);
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md mx-auto text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Fingerprint className="w-8 h-8 text-blue-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Secure Your Policy</h2>
            <p className="text-slate-400 text-sm mb-8">
                No seed phrases. No passwords. Use your device's built-in biometrics to create a secure, unrecoverable hardware identity.
            </p>

            {step === 0 && (
                <button
                    onClick={handleCreatePasskey}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Lock className="w-4 h-4" />
                    Secure with Device
                </button>
            )}

            {step === 1 && (
                <div className="py-4 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                    <p className="text-slate-300 font-medium">Waiting for Biometric Authentication...</p>
                    <p className="text-slate-500 text-xs mt-2">Please follow your device's prompt</p>
                </div>
            )}

            {step === 2 && (
                <div className="py-4 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="text-slate-300 font-medium">Provisioning Policy Identity...</p>
                    <p className="text-slate-500 text-xs mt-2">Deploying sponsored smart wallet via Relayer</p>
                </div>
            )}

            {step === 3 && (
                <div className="py-4 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-emerald-400 font-medium text-lg">Identity Secured</p>
                    <p className="text-slate-400 text-sm mt-1">Your smart wallet is active and fully funded.</p>
                </div>
            )}
        </div>
    );
};
