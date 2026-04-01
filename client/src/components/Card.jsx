import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';

// ─── Real UNO card color palettes ─────────────────────────────────────────────
const COLOR_MAP = {
  red:    { bg: '#E8001A', oval: '#CC0015', shadow: '0 8px 30px rgba(232,0,26,0.55)' },
  blue:   { bg: '#0066CC', oval: '#0050A0', shadow: '0 8px 30px rgba(0,102,204,0.55)' },
  green:  { bg: '#1A9645', oval: '#157A37', shadow: '0 8px 30px rgba(26,150,69,0.55)'  },
  yellow: { bg: '#FFD900', oval: '#E0BC00', shadow: '0 8px 30px rgba(255,217,0,0.5)'  },
  black:  { bg: '#1a1a2e', oval: '#0d0d1a', shadow: '0 8px 30px rgba(155,89,255,0.5)' },
};

// Wild card quadrant colors (matches real UNO)
const WILD_QUADRANTS = ['#E8001A','#0066CC','#1A9645','#FFD900'];

function getDisplayLabel(card) {
  if (!card) return '';
  if (card.value === 'wildDraw4') return '+4';
  if (card.value === 'wild')      return '';      // wild uses quadrant design
  if (card.value === 'draw2')     return '+2';
  if (card.value === 'skip')      return '🚫';
  if (card.value === 'reverse')   return '⟲';
  if (card.type  === 'twist')     return '⚡';
  return card.value;
}

function cardSizePx(size) {
  switch (size) {
    case 'sm': return { w: 64,  h: 96  };
    case 'lg': return { w: 110, h: 165 };
    default:   return { w: 84,  h: 126 };
  }
}

const seenCardIds = new Set();

export default function Card({
  card,
  onClick,
  isPlayable,
  isHighlighted = false,
  className     = '',
  arcIndex      = 0,
  arcTotal      = 1,
  isInHand      = false,
}) {
  const { cardGlow, cardSize, animationsEnabled } = useGameStore();
  const cardRef  = useRef(null);
  const [tilt,    setTilt]    = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [ripples, setRipples] = useState([]);

  // Deal animation fires once per card
  const isNew = card && !seenCardIds.has(card.id);
  if (card) seenCardIds.add(card.id);

  // Arc / fan
  const mid       = (arcTotal - 1) / 2;
  const distC     = arcIndex - mid;
  const arcRotate = isInHand ? distC * 3.5 : 0;

  if (!card) {
    // Card back placeholder
    const { w, h } = cardSizePx(cardSize);
    return (
      <div className={`shrink-0 relative select-none ${className}`}
           style={{ width: w, height: h, borderRadius: 10,
                    background: '#CC0015', border: '3px solid white',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
        <div style={{
          position: 'absolute', inset: 4, borderRadius: 7,
          border: '2px solid rgba(255,255,255,0.5)',
          background: '#E8001A', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 900, fontSize: '1.1rem',
                         fontStyle: 'italic', letterSpacing: 1, textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
            UNO
          </span>
        </div>
      </div>
    );
  }

  const isWild   = card.type === 'wild';
  const colorKey = card.color in COLOR_MAP ? card.color : 'black';
  const c        = COLOR_MAP[colorKey];
  const label    = getDisplayLabel(card);
  const { w, h } = cardSizePx(cardSize);

  const smallFontSize = cardSize === 'sm' ? '0.65rem' : cardSize === 'lg' ? '0.9rem' : '0.78rem';
  const bigFontSize   = cardSize === 'sm' ? '1.5rem'  : cardSize === 'lg' ? '2.8rem' : '2rem';

  // 3D tilt
  const handleMouseMove = (e) => {
    if (!animationsEnabled || !isPlayable || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setTilt({
      x: -((e.clientY - rect.top  - rect.height / 2) / (rect.height / 2)) * 10,
      y:  ((e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2)) * 10,
    });
  };

  // Click ripple
  const handleClick = useCallback((e) => {
    if (!isPlayable) return;
    if (animationsEnabled && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const id  = Date.now();
      const sz  = Math.max(rect.width, rect.height);
      setRipples(r => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top, sz }]);
      setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 520);
    }
    onClick?.();
  }, [isPlayable, animationsEnabled, onClick]);

  const hoverTx = hovered && isPlayable && animationsEnabled
    ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-20px) scale(1.1)`
    : `perspective(600px) rotateX(0) rotateY(0) translateY(0) scale(1)`;

  const dealVariants = animationsEnabled && isNew ? {
    initial: { y: -240, rotateY: 90, scale: 0.4, opacity: 0 },
    animate: {
      y: 0, rotateY: 0, scale: 1, opacity: 1,
      transition: { type: 'spring', stiffness: 200, damping: 22, delay: arcIndex * 0.06 },
    },
  } : { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.15 } } };

  return (
    <motion.div
      ref={cardRef}
      layoutId={card.id}
      variants={dealVariants}
      initial="initial"
      animate="animate"
      exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.15 } }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }); }}
      whileTap={isPlayable && animationsEnabled ? { scale: 0.93 } : {}}
      className={`relative shrink-0 select-none ${!isPlayable ? 'opacity-40' : 'cursor-pointer'} ${className}`}
      style={{
        width:           w,
        height:          h,
        borderRadius:    '10px',
        // Real UNO white border
        border:          `3px solid ${isHighlighted ? 'var(--accent-1)' : 'white'}`,
        background:      isWild ? '#1a1a2e' : c.bg,
        boxShadow:       isHighlighted
          ? `0 0 0 2px white, 0 0 20px var(--accent-glow), ${c.shadow}`
          : cardGlow && isPlayable ? c.shadow : '0 4px 14px rgba(0,0,0,0.5)',
        transform:       hoverTx,
        rotate:          `${arcRotate}deg`,
        transition:      'transform 0.15s ease, box-shadow 0.2s ease, rotate 0.22s ease',
        zIndex:          hovered ? 50 : 1,
        transformOrigin: 'bottom center',
        willChange:      'transform',
        overflow:        'hidden',
        filter:          !isPlayable ? 'grayscale(40%)' : 'none',
      }}
    >
      {/* Ripples */}
      {ripples.map(rp => (
        <span key={rp.id} className="ripple-ring"
              style={{ left: rp.x - rp.sz/2, top: rp.y - rp.sz/2, width: rp.sz, height: rp.sz }} />
      ))}

      {isWild ? (
        /* ── WILD card: 4 colored quadrants ─────────────────────────── */
        <>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
            {WILD_QUADRANTS.map((qc, i) => (
              <div key={i} style={{ background: qc }} />
            ))}
          </div>
          {/* White oval in center */}
          <div style={{
            position:    'absolute', left: '50%', top: '50%',
            width:       '80%', height: '60%',
            transform:   'translate(-50%, -50%) rotate(-30deg)',
            background:  'white',
            borderRadius: '50%',
            display:     'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow:   '0 2px 10px rgba(0,0,0,0.4)',
          }}>
            <span style={{
              transform: 'rotate(30deg)',
              fontWeight: 900, fontSize: bigFontSize,
              background: 'linear-gradient(135deg, #E8001A 0%, #FFD900 33%, #1A9645 66%, #0066CC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-1px',
            }}>
              {label || 'W'}
            </span>
          </div>
          {/* Corner labels */}
          <WildCorner size={smallFontSize} label={label || 'W'} />
        </>
      ) : (
        /* ── Normal / Action card ────────────────────────────────────── */
        <>
          {/* Colored inset border (inner card border – real UNO style) */}
          <div style={{
            position: 'absolute', inset: 3, borderRadius: 7,
            border: `2px solid rgba(255,255,255,0.25)`,
          }} />

          {/* Large diagonal oval */}
          <div style={{
            position:    'absolute', left: '50%', top: '50%',
            width:       '90%', height: '66%',
            transform:   'translate(-50%, -50%) rotate(-30deg)',
            background:  c.oval,
            borderRadius: '50%',
            boxShadow:   'inset 0 0 16px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)',
          }} />

          {/* Center label (inside oval, un-rotated) */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              color:       'white',
              fontWeight:  900,
              fontSize:    bigFontSize,
              textShadow:  '0 2px 6px rgba(0,0,0,0.6)',
              letterSpacing: '-1px',
              lineHeight:  1,
              userSelect:  'none',
            }}>
              {label}
            </span>
          </div>

          {/* Top-left corner */}
          <div style={{
            position:   'absolute', top: 5, left: 6,
            color:      'white', fontWeight: 900,
            fontSize:   smallFontSize, lineHeight: 1,
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>
            {label}
          </div>

          {/* Bottom-right corner (rotated 180°) */}
          <div style={{
            position:   'absolute', bottom: 5, right: 6,
            color:      'white', fontWeight: 900,
            fontSize:   smallFontSize, lineHeight: 1,
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            transform:  'rotate(180deg)',
          }}>
            {label}
          </div>

          {/* Shine overlay */}
          <div style={{
            position:         'absolute', inset: 0, borderRadius: 8,
            background:       'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 45%)',
            pointerEvents:    'none',
          }} />
        </>
      )}

      {/* Playable glow pulse border */}
      {isHighlighted && (
        <div style={{
          position: 'absolute', inset: -2, borderRadius: 12,
          border:   '2px solid var(--accent-1)',
          boxShadow:'0 0 16px var(--accent-glow)',
          pointerEvents: 'none',
          animation: 'glowPulse 1.2s ease-in-out infinite',
        }} />
      )}
    </motion.div>
  );
}

// Wild corner label helper
function WildCorner({ size, label }) {
  return (
    <>
      <div style={{ position:'absolute', top:5, left:6, color:'white',
                    fontWeight:900, fontSize:size, lineHeight:1,
                    textShadow:'0 1px 4px rgba(0,0,0,0.6)' }}>{label}</div>
      <div style={{ position:'absolute', bottom:5, right:6, color:'white',
                    fontWeight:900, fontSize:size, lineHeight:1,
                    textShadow:'0 1px 4px rgba(0,0,0,0.6)', transform:'rotate(180deg)' }}>{label}</div>
    </>
  );
}
