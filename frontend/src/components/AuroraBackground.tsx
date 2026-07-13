import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  radius: number;
  color: string;
}

const COLORS = [
  'rgba(56,189,248,',   // sky
  'rgba(129,140,248,',  // indigo
  'rgba(16,185,129,',   // emerald
  'rgba(248,113,113,',  // rose
  'rgba(251,191,36,',   // amber
];

const AuroraBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const MAX_PARTICLES = 45;
    const CONNECT_DISTANCE = 130;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn initial particles
    const spawn = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.2,
      radius: Math.random() * 1.8 + 0.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });

    particlesRef.current = Array.from({ length: MAX_PARTICLES }, spawn);

    const draw = () => {
      if (document.hidden) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pts = particlesRef.current;

      // Update positions
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }

      // Draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DISTANCE) {
            const lineAlpha = (1 - dist / CONNECT_DISTANCE) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `${pts[i].color}${lineAlpha})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      {/* Canvas constellation */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: 0.65 }}
      />

      {/* Aurora bands — CSS-animated gradient layers */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Band 1 — sky/indigo */}
        <div
          className="aurora-band"
          style={{
            top: '8%',
            left: '-50%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.07) 30%, rgba(129,140,248,0.09) 60%, transparent 100%)',
            animationDelay: '0s',
            animationDuration: '14s',
          }}
        />
        {/* Band 2 — indigo/violet */}
        <div
          className="aurora-band"
          style={{
            top: '35%',
            left: '-30%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.06) 25%, rgba(167,139,250,0.08) 55%, transparent 100%)',
            animationDelay: '-5s',
            animationDuration: '18s',
          }}
        />
        {/* Band 3 — emerald (subtle, mainnet feel) */}
        <div
          className="aurora-band"
          style={{
            bottom: '15%',
            left: '-40%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.04) 40%, rgba(52,211,153,0.06) 65%, transparent 100%)',
            animationDelay: '-9s',
            animationDuration: '22s',
          }}
        />
      </div>
    </>
  );
};

export default AuroraBackground;
