import { useState, useEffect } from 'react';

// Cache the fetched rate at the module level to avoid duplicate network requests across components
let cachedRate: number = 9.0; // Fallback rate (PHP per XLM)
let fetchPromise: Promise<number> | null = null;

const fetchRate = async (): Promise<number> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data && data.stellar && typeof data.stellar.php === 'number') {
      cachedRate = data.stellar.php;
      return data.stellar.php;
    }
  } catch (error) {
    console.error('Failed to fetch XLM to PHP exchange rate:', error);
  }
  return cachedRate;
};

export const useXlmToPhp = () => {
  const [rate, setRate] = useState<number>(cachedRate);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // If the rate is already updated from the default fallback
    if (cachedRate !== 9.0) {
      setRate(cachedRate);
      return;
    }

    if (!fetchPromise) {
      setIsLoading(true);
      fetchPromise = fetchRate().then((newRate) => {
        setRate(newRate);
        setIsLoading(false);
        return newRate;
      });
    } else {
      fetchPromise.then((newRate) => {
        setRate(newRate);
      });
    }
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
