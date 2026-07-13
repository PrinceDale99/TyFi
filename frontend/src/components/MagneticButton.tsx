import React, { useRef, useCallback } from 'react';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

const STRENGTH = 0.28; // pull factor

const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = '',
  onClick,
  disabled,
  type = 'button',
  title,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    const inner = innerRef.current;
    if (!btn || !inner || disabled) return;
    const rect = btn.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    inner.style.transform = `translate(${dx * STRENGTH}px, ${dy * STRENGTH}px)`;
    inner.style.transition = 'transform 0.1s ease';
  }, [disabled]);

  const onMouseLeave = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transform = 'translate(0, 0)';
    inner.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  }, []);

  return (
    <button
      ref={btnRef}
      type={type}
      className={`btn-magnetic ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <span ref={innerRef} className="magnetic-inner w-full h-full flex items-center justify-center">
        {children}
      </span>
    </button>
  );
};

export default MagneticButton;
