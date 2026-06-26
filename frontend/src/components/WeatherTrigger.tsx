import React, { useState } from 'react';

export const WeatherTrigger: React.FC<{ targetAddress: string, activeYieldBalance: number }> = ({ targetAddress, activeYieldBalance }) => {
  const [loadingState, setLoadingState] = useState<string | null>(null);
  const [cashOutSum, setCashOutSum] = useState<number | null>(null);

  const triggerDisaster = async () => {
    try {
      setLoadingState("Generating Weather Proof...");
      await new Promise(r => setTimeout(r, 1000)); 
      
      setLoadingState("Verifying Soroban Footprints...");
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${BACKEND_URL}/api/v1/weather-trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 14.5995, lon: 120.9842, severity: "TYPHOON_CATEGORY_5", targetAddress })
      });
      
      if (!res.ok) throw new Error("Transaction Failed");
      
      setLoadingState("Routing through PDAX InstaPay...");
      await new Promise(r => setTimeout(r, 800)); 
      
      setLoadingState(null);
      // Freeze the yield and apply standard FX conversion rate (e.g., 58 PHP/XLM equivalent)
      setCashOutSum(activeYieldBalance * 58.20); 
      
    } catch (err) {
      setLoadingState("Protocol Execution Failed.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl">
      {!cashOutSum ? (
        <button 
          onClick={triggerDisaster}
          disabled={loadingState !== null}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
        >
          {loadingState ? loadingState : "⚠️ Simulate Climate Disaster"}
        </button>
      ) : (
        <div className="text-center border-2 border-green-500 p-4 rounded-lg bg-green-900/30">
          <p className="text-green-400 font-bold mb-1">Disbursed to GCash (PHP)</p>
          <h2 className="text-3xl font-mono text-white">
            ₱{cashOutSum.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </h2>
        </div>
      )}
    </div>
  );
};
