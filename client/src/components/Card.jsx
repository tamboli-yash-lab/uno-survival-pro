import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';

// ─── Colour → gradient / glow ────────────────────────────────────────────────
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

function cardSizePx(size) {
  switch (size) {
    case 'sm': return { w: 72,  h: 104 };
    case 'lg': return { w: 120, h: 172 };
    default:   return { w: 96,  h: 138 };
  }
}

// ─── Track "new" card IDs per session ─────────────────────────────────────────
const seenCardIds = new Set();

export default function Card({
  card,
  onClick,
  isPlayable,
  className = '',
  // Fan layout support
  arcIndex    = 0,
  arcTotal    = 1,
  isInHand    = false,
}) {
  const { cardGlow, cardSize, animationsEnabled } = useGameStore();
  const cardRef  = useRef(null);
  const [tilt,    setTilt]    = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [ripples, setRipples] = useState([]);

  // ── Determine if this is a freshly dealt card ──────────────────────────────
  const isNew = card && !seenCardIds.has(card.id);
  if (card) seenCardIds.add(card.id);

  // ── Arc fan transform ──────────────────────────────────────────────────────
  const mid       = (arcTotal - 1) / 2;
  const distFromC = arcIndex - mid;
  const arcRotate = isInHand ? distFromC * 3.5 : 0;
  const arcTransY = isInHand ? Math.abs(distFromC) * 5 : 0;

  // ── Empty placeholder ──────────────────────────────────────────────────────
  if (!card) {
    const { w, h } = cardSizePx(cardSize);
    return (
      <div
        className={`rounded-2xl border-2 border-white/20 bg-black/50 ${className}`}
        style={{ width: w, height: h }}
      />
    );
  }

  const isWild     = card.type === 'wild' || card.type === 'twist';
  const colorKey   = card.color in COLOR_STYLES ? card.color : 'black';
  const style      = COLOR_STYLES[colorKey];
  const displayVal = getDisplayValue(card);
  const { w, h }   = cardSizePx(cardSize);

  // ── 3-D tilt on mouse move ────────────────────────────────────────────────
  const handleMouseMove = (e) => {
    if (!animationsEnabled || !isPlayable || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const dx   = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
    const dy   = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
    setTilt({ x: -dy * 12, y: dx * 12 });
  };
  const resetTilt = () => setTilt({ x: 0, y: 0 });

  // ── Click ripple ──────────────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    if (!isPlayable) return;
    if (animationsEnabled) {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        const x   = e.clientX - rect.left;
        const y   = e.clientY - rect.top;
        const id  = Date.now();
        const sz  = Math.max(rect.width, rect.height);
        setRipples(r => [...r, { id, x, y, sz }]);
        setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 500);
      }
    }
    onClick?.();
  }, [isPlayable, animationsEnabled, onClick]);

  // ── Combined 3-D transform ────────────────────────────────────────────────
  const hoverTransform = hovered && animationsEnabled && isPlayable
    ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-22px) scale(1.12)`
    : `perspective(600px) rotateX(0deg) rotateY(0deg) translateY(${hovered ? 0 : arcTransY}px) scale(1)`;

  // ── Deal animation variants ───────────────────────────────────────────────
  const dealVariants = animationsEnabled && isNew ? {
    initial: { y: -280, rotateY: 90, scale: 0.5, opacity: 0 },
    animate: {
      y: 0, rotateY: 0, scale: 1, opacity: 1,
      transition: { type: 'spring', stiffness: 200, damping: 22, delay: arcIndex * 0.07 },
    },
  } : {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2 } },
  };

  return (
    <motion.div
      ref={cardRef}
      layoutId={card.id}
      variants={dealVariants}
      initial="initial"
      animate="animate"
      exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.18 } }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); resetTilt(); }}
      whileTap={isPlayable && animationsEnabled ? { scale: 0.94 } : {}}
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
        border:        isWild ? 'none' : '3px solid rgba(255,255,255,0.35)',
        boxShadow:     cardGlow && isPlayable ? style.shadow : '0 4px 12px rgba(0,0,0,0.5)',
        transform:     hoverTransform,
        rotate:        `${arcRotate}deg`,
        transition:    'transform 0.15s ease, box-shadow 0.2s ease, rotate 0.2s ease',
        zIndex:        hovered ? 50 : 1,
        willChange:    'transform',
        transformOrigin: 'bottom center',
      }}
    >
      {/* Click ripples */}
      {ripples.map(rp => (
        <span
          key={rp.id}
          className="ripple-ring"
          style={{
            left:   rp.x - rp.sz / 2,
            top:    rp.y - rp.sz / 2,
            width:  rp.sz,
            height: rp.sz,
          }}
        />
      ))}

      {/* Top-left value */}
      <div
        className="absolute top-1.5 left-2 text-white font-black leading-none drop-shadow-md"
        style={{ fontSize: cardSize === 'sm' ? '0.75rem' : '0.95rem' }}
      >
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

      {/* Bottom-right value rotated */}
      <div
        className="absolute bottom-1.5 right-2 text-white font-black leading-none rotate-180 drop-shadow-md"
        style={{ fontSize: cardSize === 'sm' ? '0.75rem' : '0.95rem' }}
      >
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
