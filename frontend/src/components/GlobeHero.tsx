import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

export const GlobeHero: React.FC = () => {
  const globeEl = useRef<any>(null);
  const [arcsData, setArcsData] = useState<any[]>([]);

  useEffect(() => {
    // Generate random arcs flowing from/to the Philippines (approx 14.599, 120.984)
    const arcs = Array.from(Array(20).keys()).map(() => {
      const isOutbound = Math.random() > 0.5;
      const phLat = 14.599;
      const phLng = 120.984;
      const otherLat = (Math.random() - 0.5) * 160;
      const otherLng = (Math.random() - 0.5) * 360;

      return {
        startLat: isOutbound ? phLat : otherLat,
        startLng: isOutbound ? phLng : otherLng,
        endLat: isOutbound ? otherLat : phLat,
        endLng: isOutbound ? otherLng : phLng,
        color: isOutbound ? ['#38bdf8', '#a855f7'] : ['#10b981', '#38bdf8']
      };
    });

    setArcsData(arcs);

    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 1.0;
      globeEl.current.pointOfView({ lat: 14.5, lng: 121, altitude: 2 });
    }
  }, []);

  return (
    <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen overflow-hidden flex items-center justify-center pointer-events-none">
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <Globe
        ref={globeEl}
        width={1000}
        height={1000}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashInitialGap={() => Math.random()}
        arcDashAnimateTime={2000}
        atmosphereColor="#38bdf8"
        atmosphereAltitude={0.2}
      />
    </div>
  );
};

export default GlobeHero;
