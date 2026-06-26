import { useState, useEffect } from 'react';

export function useContinuousYield(basePrincipal: number, depositTimestamp: number, apy: number) {
  const [currentBalance, setCurrentBalance] = useState<number>(basePrincipal);
  
  useEffect(() => {
    const SCALE = 10000000;
    
    const intervalId = setInterval(() => {
      const nowSeconds = Date.now() / 1000;
      const elapsedSeconds = Math.max(0, nowSeconds - depositTimestamp);
      
      const tYears = elapsedSeconds / 31536000;
      const compoundsPerYear = 31536000; // Continuous second-by-second
      
      const amount = basePrincipal * Math.pow(1 + (apy / compoundsPerYear), compoundsPerYear * tYears);
      const scaledAmount = Math.floor(amount * SCALE) / SCALE;
      
      setCurrentBalance(scaledAmount);
    }, 500); // Strict 500ms heartbeat
    
    return () => clearInterval(intervalId);
  }, [basePrincipal, depositTimestamp, apy]);

  return currentBalance;
}
