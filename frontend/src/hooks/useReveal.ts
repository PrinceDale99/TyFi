import { useEffect, useRef } from 'react';

/**
 * Attach this ref to any container.
 * When it enters the viewport, class 'revealed' is added — children with
 * class 'reveal-item' will animate in via CSS (staggered by nth-child).
 */
export const useReveal = (threshold = 0.08) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
};
