import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
let cachedRate: number = 9.0;

export const useXlmToPhp = () => {
  const [rate, setRate] = useState<number>(cachedRate);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const fetchRate = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/xlm-rate`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (data && typeof data.rate === 'number') {
          cachedRate = data.rate;
          if (isMounted) setRate(data.rate);
        }
      } catch (error) {
        console.error('Failed to fetch XLM to PHP exchange rate:', error);
      }
    };

    setIsLoading(true);
    fetchRate().then(() => {
      if (isMounted) setIsLoading(false);
    });

    // Poll every 10 seconds for real-time live updates
    const interval = setInterval(fetchRate, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const convert = (xlm: number) => {
    return xlm * rate;
  };

  const formatPhp = (xlm: number) => {
    const phpVal = convert(xlm);
    return `₱${phpVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP`;
  };

  return { rate, convert, formatPhp, isLoading };
};
