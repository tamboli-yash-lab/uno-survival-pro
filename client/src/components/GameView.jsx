import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, socket } from '../store/gameStore.js';
import { rtcManager } from '../lib/webrtc.js';
import { audioManager } from '../lib/audioManager.js';
import Card from './Card.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

// ─── Colour ring map ─────────────────────────────────────────────────────────
const COLOR_RING = {
  red:    '#f56462',
  blue:   '#74b9ff',
  green:  '#55efc4',
  yellow: '#ffeaa7',
  black:  '#9b59ff',
};

// ─── SVG Arc Timer ───────────────────────────────────────────────────────────
function ArcTimer({ timeLeft, maxTime = 15 }) {
  const r       = 26;
  const circ    = 2 * Math.PI * r;
  const pct     = Math.max(0, timeLeft / maxTime);
  const dash    = circ * pct;
  const danger  = timeLeft <= 5;
  // We key the number span so each change triggers tickPulse
  return (
    <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
      {/* Outer decorative spinning ring */}
      <svg
        width="68" height="68" viewBox="0 0 68 68"
        className="absolute inset-0"
        style={{ animation: 'spin 8s linear infinite', opacity: 0.15 }}
      >
        <circle cx="34" cy="34" r={r + 8} fill="none"
          stroke="var(--accent-2)" strokeWidth="1"
          strokeDasharray="4 8" strokeLinecap="round" />
      </svg>

      <svg width="68" height="68" viewBox="0 0 68 68">
        {/* Track */}
        <circle cx="34" cy="34" r={r} fill="none"
          stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        {/* Progress arc */}
        <circle
          cx="34" cy="34" r={r}
          fill="none"
          stroke={danger ? '#ef4444' : 'var(--accent-1)'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{
            transition: 'stroke-dasharray 0.35s linear, stroke 0.3s ease',
            filter: danger ? 'drop-shadow(0 0 6px #ef4444)' : `drop-shadow(0 0 4px var(--accent-1))`,
          }}
        />
      </svg>

      {/* Tick number — key changes every second to fire tickPulse */}
      <span
        key={timeLeft}
        className="absolute font-black"
        style={{
          fontSize: '1.1rem',
          color: danger ? '#ef4444' : 'white',
          animation: 'tickPulse 0.4s ease-out',
        }}
      >
        {timeLeft}
      </span>
    </div>
  );
}

// ─── Bot Thinking Indicator ─────────────────────────────────────────────────
function BotThinking({ color }) {
  return (
    <div className="flex flex-col items-center gap-1 mt-1">
      {/* Animated dots */}
      <div className="flex gap-1" style={{ color }}>
        <span className="dot-bounce text-lg font-black">·</span>
        <span className="dot-bounce text-lg font-black">·</span>
        <span className="dot-bounce text-lg font-black">·</span>
      </div>
      {/* Progress bar */}
      <div className="w-16 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}>
        <div className="bot-progress-bar" />
      </div>
    </div>
  );
}

// ─── Main GameView ──────────────────────────────────────────────────────────
export default function GameView() {
  const {
    players, myHand, topCard, currentColor, direction,
    deckCount, turnTimeLeft, messages, username, isHost,
    hasDrawnThisTurn, confettiEnabled, animationsEnabled,
  } = useGameStore();

  const [pendingWildCardId, setPendingWildCardId] = useState(null);
  const [shake,             setShake]             = useState(false);
  const [unoAlertPlayer,    setUnoAlertPlayer]     = useState(null);
  const [reactions,         setReactions]          = useState([]);
  const [muted,             setMuted]              = useState(audioManager.muted);
  const [showSettings,      setShowSettings]        = useState(false);
  const [turnFlash,         setTurnFlash]           = useState(false);
  const [myTurnPrev,        setMyTurnPrev]          = useState(false);

  const isMyTurn  = players.find(p => p.username === username)?.isCurrentTurn;
  const ringColor = COLOR_RING[currentColor] || '#9b59ff';
  const opponents = players.filter(p => p.username !== username);

  // ── Turn start flash + badge ──────────────────────────────────────────────
  useEffect(() => {
    if (isMyTurn && !myTurnPrev && animationsEnabled) {
      setTurnFlash(true);
      setTimeout(() => setTurnFlash(false), 700);
    }
    setMyTurnPrev(!!isMyTurn);
  }, [isMyTurn]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleUno = (name) => {
      setUnoAlertPlayer(name);
      setTimeout(() => setUnoAlertPlayer(null), 2200);
    };
    const handleReaction = (data) => {
      const id = Math.random().toString();
      setReactions(prev => [...prev, { id, username: data.username, emoji: data.emoji }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2000);
    };
    const handleSound = (name) => audioManager.playCurrent(name);

    socket.on('uno_called', handleUno);
    socket.on('reaction',   handleReaction);
    socket.on('sound_effect', handleSound);
    audioManager.playBGM();

    return () => {
      socket.off('uno_called', handleUno);
      socket.off('reaction',   handleReaction);
      socket.off('sound_effect', handleSound);
      audioManager.stopBGM();
    };
  }, []);

  // ── Voice chat ────────────────────────────────────────────────────────────
  useEffect(() => {
    players.forEach(p => {
      if (p.username !== username && p.socketId)
        rtcManager.connectToPeer(p.username, p.socketId);
    });
  }, [players, username]);

  // ── Message effects ───────────────────────────────────────────────────────
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    if (lastMsg.type === 'chaos') setShake(true);
    if (lastMsg.type === 'safe' && confettiEnabled)
      confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } });
    if (lastMsg.type === 'loser' || lastMsg.type === 'safe')
      audioManager.playCurrent('win');
    setTimeout(() => setShake(false), 900);
  }, [messages]);

  // ── Card handlers ─────────────────────────────────────────────────────────
  const handlePlayCard = (card) => {
    if (card.type === 'wild' || card.type === 'twist') {
      setPendingWildCardId(card.id);
    } else {
      socket.emit('play_card', { cardId: card.id, selectedColor: null });
    }
  };

  const handleColorSelect = (color) => {
    socket.emit('play_card', { cardId: pendingWildCardId, selectedColor: color });
    setPendingWildCardId(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`w-full h-screen flex flex-col overflow-hidden relative ${shake ? 'animate-wiggle' : ''}`}>

      {/* ── Screen-edge Turn Flash ─────────────────────────────────── */}
      <AnimatePresence>
        {turnFlash && (
          <motion.div
            key="turn-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="absolute inset-0 pointer-events-none z-[300] rounded-none"
            style={{
              boxShadow: `inset 0 0 80px 20px var(--accent-1)`,
              border:    `3px solid var(--accent-1)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── "YOUR TURN" Bounce Badge ──────────────────────────────── */}
      <AnimatePresence>
        {isMyTurn && (
          <motion.div
            key="your-turn-badge"
            initial={{ y: -60, opacity: 0, scale: 0.6 }}
            animate={{ y: 0,   opacity: 1, scale: 1,
              transition: { type: 'spring', stiffness: 350, damping: 20, delay: 0.15 }
            }}
            exit={{ y: -60, opacity: 0, scale: 0.6, transition: { duration: 0.25 } }}
            className="absolute top-16 left-1/2 z-[100] pointer-events-none font-black uppercase tracking-widest text-sm px-5 py-2 rounded-full"
            style={{
              transform:   'translateX(-50%)',
              background:  'linear-gradient(135deg, var(--accent-1), var(--accent-2))',
              boxShadow:   '0 0 20px var(--accent-glow)',
              color:       'white',
              letterSpacing: '0.2em',
            }}
          >
            ✦ YOUR TURN ✦
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top-right Buttons ────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {[
          { icon: muted ? '🔇' : '🔊', action: () => setMuted(audioManager.toggleMute()) },
          { icon: '⚙️',                action: () => setShowSettings(true) },
        ].map(({ icon, action }) => (
          <motion.button
            key={icon}
            whileTap={{ scale: 0.88 }}
            onClick={action}
            className="w-10 h-10 flex items-center justify-center rounded-full text-lg"
            style={{
              background:     'rgba(0,0,0,0.5)',
              border:         '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {icon}
          </motion.button>
        ))}
      </div>

      {/* ── Opponents Row ─────────────────────────────────────────── */}
      <div className="flex justify-evenly flex-wrap w-full px-4 pt-16 z-10 gap-3 shrink-0">
        {opponents.map(p => {
          const isActive = p.isCurrentTurn;
          const isBotActive = isActive && p.isBot;
          return (
            <motion.div
              key={p.username}
              animate={isActive && animationsEnabled
                ? { scale: [1, 1.05, 1], transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }
                : { scale: 1 }
              }
              className="relative flex flex-col items-center px-5 py-3 rounded-2xl"
              style={{
                background:     isActive ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(12px)',
                // Animated gradient border via outline trick
                outline:        isActive ? `2px solid ${ringColor}` : '2px solid rgba(255,255,255,0.1)',
                boxShadow:      isActive ? `0 0 25px ${ringColor}55, 0 0 60px ${ringColor}22` : 'none',
                transition:     'outline 0.3s ease, box-shadow 0.4s ease',
              }}
            >
              {/* Spinning border ring (active only) */}
              {isActive && animationsEnabled && (
                <div
                  className="absolute -inset-[3px] rounded-2xl pointer-events-none"
                  style={{
                    background: `conic-gradient(${ringColor}, transparent, ${ringColor})`,
                    animation:  'spin 3s linear infinite',
                    opacity:    0.35,
                    borderRadius: 'inherit',
                  }}
                />
              )}

              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black mb-1 shadow-md z-10"
                style={{ background: 'var(--accent-1)', color: 'var(--bg-primary)' }}
              >
                {p.username[0]}
              </div>
              <div className="text-xs font-bold text-white/80 mb-1 uppercase tracking-wider z-10">
                {p.username}
              </div>

              {/* Mini fanned opponent cards */}
              <div className="flex items-center mb-1 z-10" style={{ height: '32px' }}>
                {Array.from({ length: Math.min(p.cardCount, 7) }).map((_, i, arr) => {
                  const mid   = (arr.length - 1) / 2;
                  const angle = (i - mid) * 8;
                  return (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        width: '18px', height: '28px',
                        background: 'linear-gradient(145deg, #c0392b, #7b241c)',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.4)',
                        transform: `rotate(${angle}deg) translateX(${(i - mid) * 10}px)`,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  );
                })}
              </div>

              <div className="text-xs font-black mt-1 z-10" style={{ color: 'var(--accent-1)' }}>
                {p.cardCount} card{p.cardCount !== 1 ? 's' : ''}
              </div>

              {/* Bot thinking dots + bar, or human THINKING text */}
              {isActive && (
                isBotActive
                  ? <BotThinking color={ringColor} />
                  : <span className="text-[10px] font-black uppercase tracking-widest animate-pulse mt-1" style={{ color: ringColor }}>
                      THINKING…
                    </span>
              )}

              {/* Emoji reactions */}
              <div className="absolute -top-2 w-full flex justify-center pointer-events-none z-20">
                <AnimatePresence>
                  {reactions.filter(r => r.username === p.username).map(r => (
                    <motion.div
                      key={r.id}
                      initial={{ y: 10, scale: 0, opacity: 0 }}
                      animate={{ y: -50, scale: 2,  opacity: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="absolute text-3xl"
                    >
                      {r.emoji}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Center Table ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center relative">

        {/* Felt glow */}
        <div
          className="absolute inset-0 m-auto rounded-full pointer-events-none"
          style={{
            width: '420px', height: '280px',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 75%)',
          }}
        />

        {/* Direction indicator */}
        <div
          className="absolute top-6 text-3xl opacity-25 select-none"
          style={{
            animation: direction === 1
              ? 'spin 5s linear infinite'
              : 'spin 5s linear infinite reverse',
          }}
        >
          {direction === 1 ? '↻' : '↺'}
        </div>

        <div className="flex gap-14 items-center">
          {/* Deck / Pass Turn */}
          {isMyTurn && hasDrawnThisTurn ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => socket.emit('pass_turn')}
            >
              <div
                className="w-28 h-40 rounded-2xl flex items-center justify-center font-black text-xl text-white/80 uppercase tracking-widest text-center leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #374151, #1f2937)',
                  border:     '3px solid rgba(255,255,255,0.2)',
                  boxShadow:  '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                PASS<br/>TURN
              </div>
            </motion.button>
          ) : (
            <motion.div
              whileHover={isMyTurn && !hasDrawnThisTurn ? { scale: 1.06 } : {}}
              whileTap={isMyTurn && !hasDrawnThisTurn ? { scale: 0.94 } : {}}
              onClick={() => isMyTurn && !hasDrawnThisTurn && socket.emit('draw_card')}
              className={`relative rounded-2xl ${isMyTurn && !hasDrawnThisTurn ? 'cursor-pointer' : 'opacity-60'}`}
              style={{
                width: '112px', height: '160px',
                background: 'linear-gradient(145deg, #1a0a20, #0d0d14)',
                border:     '3px solid rgba(255,255,255,0.15)',
                boxShadow:  isMyTurn ? `0 0 20px var(--accent-glow), 0 8px 24px rgba(0,0,0,0.5)` : '0 6px 18px rgba(0,0,0,0.4)',
              }}
            >
              <div
                className="absolute inset-2 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #c0392b, #7b241c)' }}
              >
                <span className="font-display text-5xl italic text-white/20 -rotate-[30deg]" style={{ userSelect: 'none' }}>
                  UNO
                </span>
              </div>
              <div className="absolute -bottom-6 w-full text-center text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {deckCount} left
              </div>
            </motion.div>
          )}

          {/* Discard pile — layoutId enables card-play shared transition */}
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-2xl pointer-events-none"
              style={{
                border:    `3px solid ${ringColor}`,
                boxShadow: `0 0 30px ${ringColor}55`,
                animation: 'ringPulse 1.8s ease-in-out infinite',
                '--ring-color': ringColor,
              }}
            />
            {topCard && (
              <Card card={topCard} className="!border-4 !border-white/80" />
            )}
          </div>
        </div>

        {/* UNO Button + Reactions */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <AnimatePresence>
            {myHand.length <= 2 && (
              <motion.button
                key="uno-button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => socket.emit('call_uno')}
                className="font-black text-3xl italic px-12 py-4 rounded-full border-4"
                style={{
                  background:  '#f56462',
                  borderColor: 'rgba(255,255,255,0.3)',
                  color:       'white',
                  boxShadow:   '0 0 30px rgba(245,100,98,0.7), 0 0 60px rgba(245,100,98,0.3)',
                  animation:   'glowPulse 1.2s ease-in-out infinite',
                }}
              >
                UNO!
              </motion.button>
            )}
          </AnimatePresence>

          <div
            className="flex gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {['👍','😂','🔥','😡','💀'].map(emoji => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => socket.emit('reaction', emoji)}
                className="text-2xl"
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* ── My Hand with Arc Fan ──────────────────────────────────── */}
      <div className="flex flex-col items-center pb-6 shrink-0 relative z-10">
        {/* Timer + label */}
        {isMyTurn && turnTimeLeft !== null && (
          <div className="absolute -top-24 flex items-center gap-3">
            <ArcTimer timeLeft={turnTimeLeft} maxTime={15} />
            <span className="text-sm font-bold text-white/60 uppercase tracking-widest">Your Turn</span>
          </div>
        )}

        {/* Wild colour picker */}
        <AnimatePresence>
          {pendingWildCardId && (
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0,  opacity: 1, scale: 1 }}
              exit={{ y: 20,    opacity: 0, scale: 0.9 }}
              className="absolute -top-24 flex gap-3 px-5 py-4 rounded-2xl"
              style={{
                background:     'rgba(0,0,0,0.85)',
                border:         '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(20px)',
                boxShadow:      '0 12px 40px rgba(0,0,0,0.6)',
              }}
            >
              {['red','blue','green','yellow'].map(c => (
                <motion.button
                  key={c}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleColorSelect(c)}
                  className="w-11 h-11 rounded-full"
                  style={{
                    background: COLOR_RING[c] || c,
                    boxShadow:  `0 0 14px ${COLOR_RING[c] || c}`,
                    border:     '2px solid rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arc fan hand */}
        <motion.div
          className="flex items-end justify-center max-w-5xl px-4"
          style={{ minHeight: '160px', position: 'relative' }}
          animate={isMyTurn && animationsEnabled
            ? { y: [4, 0], transition: { type: 'spring', stiffness: 200, damping: 18 } }
            : {}
          }
        >
          <AnimatePresence>
            {myHand.map((c, i) => (
              <Card
                key={c.id}
                card={c}
                isPlayable={isMyTurn && !pendingWildCardId}
                onClick={() => handlePlayCard(c)}
                arcIndex={i}
                arcTotal={myHand.length}
                isInHand={true}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Player label */}
        <motion.div
          animate={{ color: isMyTurn ? 'var(--accent-1)' : 'white' }}
          transition={{ duration: 0.4 }}
          className="mt-4 px-8 py-2 rounded-full font-black tracking-widest text-base"
          style={{
            background: 'rgba(0,0,0,0.6)',
            border:     '1px solid rgba(255,255,255,0.15)',
            boxShadow:  isMyTurn ? '0 0 15px var(--accent-glow)' : 'none',
            transition: 'box-shadow 0.4s ease',
          }}
        >
          {username} — YOU
        </motion.div>
      </div>

      {/* ── Game Log ──────────────────────────────────────────────── */}
      <div
        className="absolute bottom-4 left-4 w-60 max-h-40 overflow-y-auto p-3 rounded-2xl pointer-events-none text-xs space-y-1"
        style={{
          background:     'rgba(0,0,0,0.55)',
          border:         '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <AnimatePresence initial={false}>
          {messages.slice(-6).map((m, i) => (
            <motion.div
              key={m.text + i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-medium leading-tight"
              style={{
                color: m.type === 'chaos'  ? '#e879f9'
                     : m.type === 'alert'  ? '#f87171'
                     : m.type === 'safe'   ? '#4ade80'
                     :                       'rgba(255,255,255,0.65)',
              }}
            >
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── UNO Flash Alert ───────────────────────────────────────── */}
      <AnimatePresence>
        {unoAlertPlayer && (
          <motion.div
            initial={{ scale: 3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-[200]"
            style={{
              background: 'radial-gradient(ellipse, rgba(245,100,98,0.25) 0%, transparent 70%)',
            }}
          >
            <h1
              className="font-display text-[10rem] italic -rotate-12 drop-shadow-2xl"
              style={{
                color:      '#f56462',
                textShadow: '0 0 60px rgba(245,100,98,0.9), 0 0 120px rgba(245,100,98,0.5)',
                WebkitTextStroke: '2px white',
              }}
            >
              {unoAlertPlayer}<br/>UNO!
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings Panel ──────────────────────────────────────── */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
