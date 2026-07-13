import { useState, useEffect, useRef, useCallback } from 'react';

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const useCountUp = (
  target: number,
  duration = 1100,
  decimals = 0,
) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);
  const startValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = null;
    const startVal = value;
    startValueRef.current = startVal;
    
    if (startVal === target) return;

    const animate = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = startVal + (target - startVal) * eased;
      
      setValue(parseFloat(current.toFixed(decimals)));
      
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };
    
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { value };
};
