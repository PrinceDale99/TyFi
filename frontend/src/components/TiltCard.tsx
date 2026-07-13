import React from 'react';
import { useTilt } from '../hooks/useTilt';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Skip tilt (e.g. for interactive inner elements) */
  disabled?: boolean;
}

// Detect touch devices once at module level
const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  disabled = false,
}) => {
  const { ref, onMouseMove, onMouseLeave } = useTilt();

  // No tilt on touch devices — no hover interaction exists
  if (disabled || isTouchDevice) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`relative overflow-hidden ${className}`}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
    >
      {/* Moving highlight shine */}
      <div className="tilt-shine absolute inset-0 rounded-[inherit] pointer-events-none z-10" />
      {children}
    </div>
  );
};

export default TiltCard;
