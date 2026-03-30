import React, { useState, useEffect } from 'react';
import { useGameStore, socket } from '../store/gameStore.js';
import { rtcManager } from '../lib/webrtc.js';
import { audioManager } from '../lib/audioManager.js';
import Card from './Card.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

// ─── SVG Arc Countdown Timer ──────────────────────────────────────────────────
function ArcTimer({ timeLeft, maxTime = 15 }) {
  const r      = 24;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.max(0, timeLeft / maxTime);
  const dash   = circ * pct;
  const danger = timeLeft <= 5;

  return (
    <div className={`flex items-center gap-2 ${danger ? 'animate-wiggle' : ''}`}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        {/* Track */}
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        {/* Arc */}
        <circle
          cx="30" cy="30" r={r}
          fill="none"
          stroke={danger ? '#ef4444' : 'var(--accent-1)'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: 'stroke-dasharray 0.3s linear' }}
        />
        {/* Number */}
        <text
          x="30" y="35"
          textAnchor="middle"
          fill={danger ? '#ef4444' : 'white'}
          fontSize="15"
          fontWeight="900"
          fontFamily="Inter, sans-serif"
        >
          {timeLeft}
        </text>
      </svg>
    </div>
  );
}

// ─── Colour Ring around Discard Pile ─────────────────────────────────────────
const COLOR_RING = {
  red:    '#f56462',
  blue:   '#74b9ff',
  green:  '#55efc4',
  yellow: '#ffeaa7',
  black:  '#9b59ff',
};

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

  // ── Socket side-effects ───────────────────────────────────────────────────
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
    socket.on('reaction', handleReaction);
    socket.on('sound_effect', handleSound);
    audioManager.playBGM();

    return () => {
      socket.off('uno_called', handleUno);
      socket.off('reaction', handleReaction);
      socket.off('sound_effect', handleSound);
      audioManager.stopBGM();
    };
  }, []);

  // Voice chat
  useEffect(() => {
    players.forEach(p => {
      if (p.username !== username && p.socketId) {
        rtcManager.connectToPeer(p.username, p.socketId);
      }
    });
  }, [players, username]);

  // Message effects
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    if (lastMsg.type === 'chaos') setShake(true);
    if (lastMsg.type === 'safe' && confettiEnabled) {
      confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } });
    }
    if (lastMsg.type === 'loser' || lastMsg.type === 'safe') audioManager.playCurrent('win');
    setTimeout(() => setShake(false), 900);
  }, [messages]);

  // ── Handlers ─────────────────────────────────────────────────────────────
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

  const isMyTurn   = players.find(p => p.username === username)?.isCurrentTurn;
  const ringColor  = COLOR_RING[currentColor] || '#9b59ff';
  const opponents  = players.filter(p => p.username !== username);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`w-full h-screen flex flex-col overflow-hidden relative ${shake ? 'animate-wiggle' : ''}`}
    >
      {/* ── Floating Buttons (top-right) ─────────────────────────── */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setMuted(audioManager.toggleMute())}
          className="w-10 h-10 flex items-center justify-center rounded-full text-lg transition-all"
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full text-lg transition-all"
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
          }}
        >
          ⚙️
        </button>
      </div>

      {/* ── Opponents Row ─────────────────────────────────────────── */}
      <div className="flex justify-evenly flex-wrap w-full px-4 pt-4 z-10 gap-3 shrink-0">
        {opponents.map(p => {
          const isActive = p.isCurrentTurn;
          return (
            <div
              key={p.username}
              className="relative flex flex-col items-center px-5 py-3 rounded-2xl transition-all"
              style={{
                background:  isActive ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.45)',
                border:      isActive ? `2px solid ${ringColor}` : '2px solid rgba(255,255,255,0.1)',
                boxShadow:   isActive ? `0 0 25px ${ringColor}55` : 'none',
                backdropFilter: 'blur(12px)',
                transform:   isActive ? 'scale(1.06)' : 'scale(1)',
              }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black mb-1 shadow-md"
                style={{ background: 'var(--accent-1)', color: 'var(--bg-primary)' }}
              >
                {p.username[0]}
              </div>
              <div className="text-xs font-bold text-white/80 mb-1 uppercase tracking-wider">
                {p.username}
              </div>

              {/* Mini fanned cards */}
              <div className="flex items-center mb-1" style={{ height: '32px' }}>
                {Array.from({ length: Math.min(p.cardCount, 7) }).map((_, i, arr) => {
                  const mid   = (arr.length - 1) / 2;
                  const angle = (i - mid) * 7;
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
                      }}
                    />
                  );
                })}
              </div>
              <div
                className="text-xs font-black mt-1"
                style={{ color: 'var(--accent-1)' }}
              >
                {p.cardCount} card{p.cardCount !== 1 ? 's' : ''}
              </div>
              {isActive && (
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse mt-1"
                      style={{ color: ringColor }}>
                  THINKING…
                </span>
              )}

              {/* Emoji reactions */}
              <div className="absolute -top-2 w-full flex justify-center pointer-events-none">
                <AnimatePresence>
                  {reactions.filter(r => r.username === p.username).map(r => (
                    <motion.div
                      key={r.id}
                      initial={{ y: 10, scale: 0, opacity: 0 }}
                      animate={{ y: -50, scale: 2, opacity: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="absolute text-3xl"
                    >
                      {r.emoji}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Center Table ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center relative">

        {/* Felt table background */}
        <div
          className="absolute inset-0 m-auto rounded-full pointer-events-none"
          style={{
            width:      '420px',
            height:     '280px',
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
          {/* Deck or Pass Turn */}
          {isMyTurn && hasDrawnThisTurn ? (
            <button
              onClick={() => socket.emit('pass_turn')}
              className="relative cursor-pointer transition-all hover:scale-105 active:scale-95"
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
            </button>
          ) : (
            <div
              onClick={() => isMyTurn && !hasDrawnThisTurn && socket.emit('draw_card')}
              className={`relative rounded-2xl transition-all ${isMyTurn && !hasDrawnThisTurn ? 'cursor-pointer hover:scale-105 active:scale-95' : 'opacity-60'}`}
              style={{
                width:     '112px',
                height:    '160px',
                background:'linear-gradient(145deg, #1a0a20, #0d0d14)',
                border:    '3px solid rgba(255,255,255,0.15)',
                boxShadow: isMyTurn ? `0 0 20px var(--accent-glow), 0 8px 24px rgba(0,0,0,0.5)` : '0 6px 18px rgba(0,0,0,0.4)',
              }}
            >
              <div
                className="absolute inset-2 rounded-xl flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #c0392b, #7b241c)' }}
              >
                <span
                  className="font-display text-5xl italic text-white/20 -rotate-[30deg]"
                  style={{ userSelect: 'none' }}
                >
                  UNO
                </span>
              </div>
              <div
                className="absolute -bottom-6 w-full text-center text-xs font-bold"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                {deckCount} left
              </div>
            </div>
          )}

          {/* Discard pile + colour glow ring */}
          <div className="relative">
            {/* Pulse ring matching current colour */}
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
          {myHand.length <= 2 && (
            <button
              onClick={() => socket.emit('call_uno')}
              className="font-black text-3xl italic px-12 py-4 rounded-full border-4 transition-all hover:scale-110 active:scale-90"
              style={{
                background:  '#f56462',
                borderColor: 'rgba(255,255,255,0.3)',
                color:       'white',
                boxShadow:   '0 0 30px rgba(245,100,98,0.7), 0 0 60px rgba(245,100,98,0.3)',
                animation:   'glowPulse 1.2s ease-in-out infinite',
              }}
            >
              UNO!
            </button>
          )}

          {/* Emoji reactions */}
          <div
            className="flex gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {['👍','😂','🔥','😡','💀'].map(emoji => (
              <button
                key={emoji}
                onClick={() => socket.emit('reaction', emoji)}
                className="text-2xl hover:scale-125 active:scale-90 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── My Hand ────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center pb-6 shrink-0 relative z-10">
        {/* Timer */}
        {isMyTurn && turnTimeLeft !== null && (
          <div className="absolute -top-20 flex items-center gap-3">
            <ArcTimer timeLeft={turnTimeLeft} maxTime={15} />
            <span className="text-sm font-bold text-white/60 uppercase tracking-widest">Your Turn</span>
          </div>
        )}

        {/* Wild colour picker */}
        <AnimatePresence>
          {pendingWildCardId && (
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.9 }}
              className="absolute -top-24 flex gap-3 px-5 py-4 rounded-2xl"
              style={{
                background:     'rgba(0,0,0,0.85)',
                border:         '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(20px)',
                boxShadow:      '0 12px 40px rgba(0,0,0,0.6)',
              }}
            >
              {['red','blue','green','yellow'].map(c => (
                <button
                  key={c}
                  onClick={() => handleColorSelect(c)}
                  className="w-11 h-11 rounded-full hover:scale-110 active:scale-95 transition-all"
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

        {/* Cards */}
        <div
          className={`flex flex-wrap justify-center gap-1.5 max-w-5xl px-4 transition-all ${isMyTurn ? '' : 'opacity-60'}`}
        >
          <AnimatePresence>
            {myHand.map(c => (
              <Card
                key={c.id}
                card={c}
                isPlayable={isMyTurn && !pendingWildCardId}
                onClick={() => handlePlayCard(c)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Player label */}
        <div
          className="mt-4 px-8 py-2 rounded-full font-black tracking-widest text-base"
          style={{
            background: 'rgba(0,0,0,0.6)',
            border:     '1px solid rgba(255,255,255,0.15)',
            color:      isMyTurn ? 'var(--accent-1)' : 'white',
            boxShadow:  isMyTurn ? '0 0 15px var(--accent-glow)' : 'none',
          }}
        >
          {username} — YOU
        </div>
      </div>

      {/* ── Game Log ───────────────────────────────────────────────── */}
      <div
        className="absolute bottom-4 left-4 w-60 max-h-40 overflow-y-auto p-3 rounded-2xl pointer-events-none text-xs space-y-1"
        style={{
          background:     'rgba(0,0,0,0.55)',
          border:         '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {messages.slice(-6).map((m, i) => (
          <div
            key={i}
            className="font-medium leading-tight"
            style={{
              color: m.type === 'chaos'  ? '#e879f9'
                   : m.type === 'alert'  ? '#f87171'
                   : m.type === 'safe'   ? '#4ade80'
                   :                       'rgba(255,255,255,0.65)',
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      {/* ── UNO Flash Alert ────────────────────────────────────────── */}
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

      {/* ── End of Game Overlay ────────────────────────────────────── */}
      {/* (handled by EndScreen component via App.jsx) */}

      {/* ── Settings Panel ─────────────────────────────────────────── */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
