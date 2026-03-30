import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';

// ─── Card colour → gradient / glow ────────────────────────────────────────────
const COLOR_STYLES = {
  red:    { bg: 'card-red',    glow: '#ff6b6b', shadow: '0 8px 30px rgba(255,80,80,0.5),  0 2px 8px rgba(0,0,0,0.6)' },
  blue:   { bg: 'card-blue',   glow: '#74b9ff', shadow: '0 8px 30px rgba(0,100,220,0.5), 0 2px 8px rgba(0,0,0,0.6)' },
  green:  { bg: 'card-green',  glow: '#55efc4', shadow: '0 8px 30px rgba(40,180,80,0.5),  0 2px 8px rgba(0,0,0,0.6)' },
  yellow: { bg: 'card-yellow', glow: '#ffeaa7', shadow: '0 8px 30px rgba(243,156,18,0.5), 0 2px 8px rgba(0,0,0,0.6)' },
  black:  { bg: 'bg-uno-black', glow: '#9b59ff', shadow: '0 8px 30px rgba(155,89,255,0.5), 0 2px 8px rgba(0,0,0,0.6)' },
  twist:  { bg: 'bg-gradient-to-br from-purple-500 via-pink-500 to-red-500', glow: '#ff2d78', shadow: '0 8px 30px rgba(255,45,120,0.5), 0 2px 8px rgba(0,0,0,0.6)' },
};

function getDisplayValue(card) {
  if (!card) return '';
  if (card.type === 'wild')        return 'W';
  if (card.value === 'wildDraw4')  return '+4';
  if (card.value === 'draw2')      return '+2';
  if (card.value === 'skip')       return '⊘';
  if (card.value === 'reverse')    return '⇄';
  if (card.type === 'twist')       return '⚡';
  return card.value;
}

export default function Card({ card, onClick, isPlayable, className = '' }) {
  const { cardGlow, cardSize, animationsEnabled } = useGameStore();
  const cardRef   = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  if (!card) {
    return (
      <div
        className={`rounded-2xl border-2 border-white/20 bg-black/50 ${className}`}
        style={{ width: cardSizePx(cardSize).w, height: cardSizePx(cardSize).h }}
      />
    );
  }

  const isWild     = card.type === 'wild' || card.type === 'twist';
  const colorKey   = card.color in COLOR_STYLES ? card.color : 'black';
  const style      = COLOR_STYLES[colorKey];
  const displayVal = getDisplayValue(card);
  const { w, h }   = cardSizePx(cardSize);

  // 3-D tilt on mouse move
  const handleMouseMove = (e) => {
    if (!animationsEnabled || !isPlayable) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const dx   = (e.clientX - cx) / (rect.width  / 2);
    const dy   = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: -dy * 12, y: dx * 12 });
  };
  const resetTilt = () => setTilt({ x: 0, y: 0 });

  const transform3d = hovered && animationsEnabled && isPlayable
    ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-22px) scale(1.12)`
    : 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)';

  return (
    <motion.div
      ref={cardRef}
      layoutId={card.id}
      onClick={isPlayable ? onClick : undefined}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); resetTilt(); }}
      animate={animationsEnabled ? {} : {}}
      whileTap={isPlayable && animationsEnabled ? { scale: 0.95 } : {}}
      className={`
        relative shrink-0 select-none overflow-hidden
        ${isWild ? 'card-wild-border' : ''}
        ${hovered && isPlayable ? 'card-shimmer' : ''}
        ${style.bg}
        ${isPlayable ? 'cursor-pointer' : 'opacity-40 grayscale-[30%]'}
        ${className}
      `}
      style={{
        width:         w,
        height:        h,
        borderRadius:  '14px',
        border:        isWild ? 'none' : `3px solid rgba(255,255,255,0.35)`,
        boxShadow:     cardGlow && isPlayable ? style.shadow : '0 4px 12px rgba(0,0,0,0.5)',
        transform:     transform3d,
        transition:    'transform 0.15s ease, box-shadow 0.2s ease',
        zIndex:        hovered ? 50 : 1,
        willChange:    'transform',
      }}
    >
      {/* Top-left value */}
      <div className="absolute top-1.5 left-2 text-white font-black leading-none drop-shadow-md"
           style={{ fontSize: cardSize === 'sm' ? '0.75rem' : '0.95rem' }}>
        {displayVal}
      </div>

      {/* Centre oval */}
      <div
        className="absolute inset-0 m-auto flex items-center justify-center"
        style={{
          width: '82%', height: '58%',
          border: '3px solid rgba(255,255,255,0.55)',
          borderRadius: '50%',
          transform: 'skewY(-10deg)',
          background: 'rgba(255,255,255,0.15)',
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.3)',
        }}
      >
        <span
          className={`font-black text-white drop-shadow-lg ${isWild ? 'animate-glow-pulse' : ''}`}
          style={{
            fontSize:    cardSize === 'sm' ? '1.6rem' : cardSize === 'lg' ? '3rem' : '2.2rem',
            transform:   'skewY(10deg)',
            letterSpacing: '0.02em',
            background:  isWild ? 'linear-gradient(90deg,#ff0,#f0f,#0ff,#0f0)' : undefined,
            WebkitBackgroundClip: isWild ? 'text' : undefined,
            WebkitTextFillColor: isWild ? 'transparent' : undefined,
          }}
        >
          {displayVal}
        </span>
      </div>

      {/* Bottom-right value (rotated) */}
      <div className="absolute bottom-1.5 right-2 text-white font-black leading-none rotate-180 drop-shadow-md"
           style={{ fontSize: cardSize === 'sm' ? '0.75rem' : '0.95rem' }}>
        {displayVal}
      </div>

      {/* Shine overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
        }}
      />
    </motion.div>
  );
}

function cardSizePx(size) {
  switch (size) {
    case 'sm': return { w: '72px',  h: '104px' };
    case 'lg': return { w: '120px', h: '172px' };
    default:   return { w: '96px',  h: '138px' };
  }
}
