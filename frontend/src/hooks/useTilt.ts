import { useRef, useCallback } from 'react';

const TILT_MAX = 8; // degrees — balanced depth without being jarring

export const useTilt = () => {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const rotX = -dy * TILT_MAX;
    const rotY = dx * TILT_MAX;
    const shineX = ((e.clientX - rect.left) / rect.width) * 100;
    const shineY = ((e.clientY - rect.top) / rect.height) * 100;

    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.018, 1.018, 1.018)`;
    el.style.transition = 'transform 0.08s ease';

    const shine = el.querySelector<HTMLElement>('.tilt-shine');
    if (shine) {
      shine.style.background = `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.12) 0%, transparent 65%)`;
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    el.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
    const shine = el.querySelector<HTMLElement>('.tilt-shine');
    if (shine) shine.style.background = 'transparent';
  }, []);

  return { ref, onMouseMove, onMouseLeave };
};
