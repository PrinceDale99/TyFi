import React, { useEffect, useRef } from 'react';

interface ParticleBurstProps {
  trigger: number; // increment to fire
  originRef?: React.RefObject<HTMLElement>;
  colors?: string[];
}

interface BurstParticle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
}

let _id = 0;

const DEFAULT_COLORS = [
  '#38bdf8', '#818cf8', '#10b981', '#f59e0b', '#f87171', '#a78bfa',
];

const ParticleBurst: React.FC<ParticleBurstProps> = ({
  trigger,
  originRef,
  colors = DEFAULT_COLORS,
}) => {
  const [particles, setParticles] = React.useState<BurstParticle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (trigger > prevTrigger.current) {
      prevTrigger.current = trigger;
      // Determine origin point
      let ox = window.innerWidth / 2;
      let oy = window.innerHeight / 2;
      if (originRef?.current) {
        const r = originRef.current.getBoundingClientRect();
        ox = r.left + r.width / 2;
        oy = r.top + r.height / 2;
      }

      const burst: BurstParticle[] = Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 60 + Math.random() * 80;
        return {
          id: ++_id,
          x: ox,
          y: oy,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 4 + Math.random() * 4,
        };
      });

      setParticles(burst);
      setTimeout(() => setParticles([]), 900);
    }
    prevTrigger.current = trigger;
  }, [trigger, colors, originRef]);

  if (!particles.length) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[999]">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: p.color,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 6px ${p.color}`,
            animation: 'particle-out 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default ParticleBurst;
