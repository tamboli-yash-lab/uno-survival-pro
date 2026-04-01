import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGameStore, socket } from '../store/gameStore.js';
import { rtcManager }  from '../lib/webrtc.js';
import { audioManager } from '../lib/audioManager.js';
import Card from './Card.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { sortHand } from '../lib/cardSorter.js';
import { isValidPlay } from '../../../shared/gameLogic.js';

// ─── Colour ring map ─────────────────────────────────────────────────────────
const COLOR_RING = {
  red: '#f56462', blue: '#74b9ff', green: '#55efc4',
  yellow: '#ffeaa7', black: '#9b59ff',
};

// ─── SVG Arc Timer ───────────────────────────────────────────────────────────
function ArcTimer({ timeLeft, maxTime = 15 }) {
  const r      = 26;
  const circ   = 2 * Math.PI * r;
  const pct    = Math.max(0, timeLeft / maxTime);
  const danger = timeLeft <= 5;
  return (
    <div className="timer-mobile relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
      <svg width="68" height="68" viewBox="0 0 68 68" className="absolute inset-0"
           style={{ animation: 'spin 8s linear infinite', opacity: 0.15 }}>
        <circle cx="34" cy="34" r={r + 8} fill="none" stroke="var(--accent-2)"
          strokeWidth="1" strokeDasharray="4 8" strokeLinecap="round" />
      </svg>
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle cx="34" cy="34" r={r} fill="none"
          stroke={danger ? '#ef4444' : 'var(--accent-1)'}
          strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{
            transition: 'stroke-dasharray 0.35s linear, stroke 0.3s ease',
            filter: danger ? 'drop-shadow(0 0 6px #ef4444)' : 'drop-shadow(0 0 4px var(--accent-1))',
          }} />
      </svg>
      <span key={timeLeft} className="absolute font-black"
            style={{ fontSize: '1.1rem', color: danger ? '#ef4444' : 'white',
                     animation: 'tickPulse 0.4s ease-out' }}>
        {timeLeft}
      </span>
    </div>
  );
}

// ─── Bot thinking indicator ───────────────────────────────────────────────────
function BotThinking({ color }) {
  return (
    <div className="flex flex-col items-center gap-1 mt-1">
      <div className="flex gap-1" style={{ color }}>
        <span className="dot-bounce text-lg font-black">·</span>
        <span className="dot-bounce text-lg font-black">·</span>
        <span className="dot-bounce text-lg font-black">·</span>
      </div>
      <div className="w-16 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}>
        <div className="bot-progress-bar" />
      </div>
    </div>
  );
}

// ─── Draw Stack Badge ─────────────────────────────────────────────────────────
function DrawStackBadge({ count, type }) {
  if (!count) return null;
  return (
    <motion.div
      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
      className="absolute -top-8 left-1/2 -translate-x-1/2 font-black text-sm px-3 py-1 rounded-full"
      style={{
        background:  'linear-gradient(135deg, #ef4444, #b91c1c)',
        color:       'white',
        boxShadow:   '0 0 16px rgba(239,68,68,0.7)',
        whiteSpace:  'nowrap',
      }}
    >
      Stack: +{count} {type === 'wildDraw4' ? '(+4)' : '(+2)'}
    </motion.div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function GameView() {
  const {
    players, myHand, topCard, currentColor, direction,
    deckCount, turnTimeLeft, messages, username,
    hasDrawnThisTurn, confettiEnabled, animationsEnabled,
    autoSort, updateSetting, roomSettings,
    drawStack, drawStackType,
  } = useGameStore();

  const [pendingWildCardId, setPendingWildCardId] = useState(null);
  const [shake,             setShake]             = useState(false);
  const [unoAlertPlayer,    setUnoAlertPlayer]     = useState(null);
  const [reactions,         setReactions]          = useState([]);
  const [muted,             setMuted]              = useState(audioManager.muted);
  const [showSettings,      setShowSettings]        = useState(false);
  const [turnFlash,         setTurnFlash]           = useState(false);
  const [myTurnPrev,        setMyTurnPrev]          = useState(false);
  const [catchTarget,       setCatchTarget]         = useState(null); // username with 1 uncalled card

  const isMyTurn  = players.find(p => p.username === username)?.isCurrentTurn;
  const ringColor = COLOR_RING[currentColor] || '#9b59ff';
  const opponents = players.filter(p => p.username !== username);

  // ── Turn-start flash ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isMyTurn && !myTurnPrev && animationsEnabled) {
      setTurnFlash(true);
      setTimeout(() => setTurnFlash(false), 700);
    }
    setMyTurnPrev(!!isMyTurn);
  }, [isMyTurn]);

  // ── Auto-UNO sound at 1 card ──────────────────────────────────────────────
  useEffect(() => {
    if (myHand.length === 1) {
      audioManager.playCurrent('uno');
    }
  }, [myHand.length]);

  // ── Detect catch target (opponent with 1 card + no UNO call) ─────────────
  useEffect(() => {
    const target = opponents.find(p => p.cardCount === 1 && !p.calledUno && p.isActive && !p.isSafe);
    setCatchTarget(target?.username || null);
  }, [players]);

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
    const handleUnoCaught = ({ catcher, target }) => {
      setUnoAlertPlayer(`${catcher} caught ${target}!`);
      setTimeout(() => setUnoAlertPlayer(null), 2000);
    };
    const handleSound = (name) => audioManager.playCurrent(name);

    socket.on('uno_called',   handleUno);
    socket.on('uno_caught',   handleUnoCaught);
    socket.on('reaction',     handleReaction);
    socket.on('sound_effect', handleSound);
    audioManager.playBGM();

    return () => {
      socket.off('uno_called',   handleUno);
      socket.off('uno_caught',   handleUnoCaught);
      socket.off('reaction',     handleReaction);
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
    const m = messages[messages.length - 1];
    if (!m) return;
    if (m.type === 'chaos') setShake(true);
    if (m.type === 'safe' && confettiEnabled)
      confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } });
    if (m.type === 'loser' || m.type === 'safe') audioManager.playCurrent('win');
    setTimeout(() => setShake(false), 900);
  }, [messages]);

  // ── Card handlers ─────────────────────────────────────────────────────────
  const handlePlayCard = (card) => {
    if (card.type === 'wild') { setPendingWildCardId(card.id); }
    else { socket.emit('play_card', { cardId: card.id, selectedColor: null }); }
  };
  const handleColorSelect = (color) => {
    socket.emit('play_card', { cardId: pendingWildCardId, selectedColor: color });
    setPendingWildCardId(null);
  };
  const handleJumpIn = (card) => socket.emit('jump_in', { cardId: card.id });

  // ── Sorted hand ───────────────────────────────────────────────────────────
  const displayHand = useMemo(
    () => autoSort ? sortHand(myHand) : myHand,
    [myHand, autoSort]
  );

  // ── Valid play check (client-side highlight) ──────────────────────────────
  const isCardPlayable = (card) => {
    if (!isMyTurn || !!pendingWildCardId) return false;
    // If draw stack active, only stackable cards are valid
    if (drawStack > 0) {
      return (drawStackType === 'draw2' && card.value === 'draw2') ||
             (drawStackType === 'wildDraw4' && card.value === 'wildDraw4');
    }
    return isValidPlay(card, topCard, currentColor, displayHand, roomSettings);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`w-full h-screen flex flex-col overflow-hidden relative ${shake ? 'animate-wiggle' : ''}`}>

      {/* ── Turn edge flash ────────────────────────────────────────── */}
      <AnimatePresence>
        {turnFlash && (
          <motion.div key="flash"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0] }} exit={{ opacity: 0 }}
            transition={{ duration: 0.65 }}
            className="absolute inset-0 pointer-events-none z-[300]"
            style={{ boxShadow: 'inset 0 0 80px 20px var(--accent-1)', border: '3px solid var(--accent-1)' }} />
        )}
      </AnimatePresence>

      {/* ── YOUR TURN badge ────────────────────────────────────────── */}
      <AnimatePresence>
        {isMyTurn && (
          <motion.div key="my-turn"
            initial={{ y: -60, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 20, delay: 0.15 } }}
            exit={{ y: -60, opacity: 0, scale: 0.6 }}
            className="absolute top-16 left-1/2 z-[100] pointer-events-none font-black uppercase tracking-widest text-sm px-5 py-2 rounded-full"
            style={{
              transform: 'translateX(-50%)', color: 'white',
              background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))',
              boxShadow:  '0 0 20px var(--accent-glow)',
              letterSpacing: '0.2em',
            }}
          >
            ✦ YOUR TURN ✦
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Draw Stack Banner ──────────────────────────────────────── */}
      <AnimatePresence>
        {drawStack > 0 && (
          <motion.div key="drawstack"
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="absolute top-4 left-1/2 z-[90] pointer-events-none font-black text-sm px-5 py-2 rounded-full"
            style={{
              transform:   'translateX(-50%)',
              background:  'linear-gradient(135deg, #ef4444, #b91c1c)',
              boxShadow:   '0 0 20px rgba(239,68,68,0.6)',
              color:       'white',
              letterSpacing: '0.1em',
            }}
          >
            ⚠️ Draw Stack: +{drawStack} — {isMyTurn ? 'Stack or Accept!' : 'Incoming!'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top-right buttons ──────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {[
          { icon: muted ? '🔇' : '🔊', action: () => setMuted(audioManager.toggleMute()) },
          { icon: '⚙️',                action: () => setShowSettings(true) },
        ].map(({ icon, action }) => (
          <motion.button key={icon} whileTap={{ scale: 0.88 }} onClick={action}
            className="w-10 h-10 flex items-center justify-center rounded-full text-lg"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            {icon}
          </motion.button>
        ))}
      </div>

      {/* ── Opponents Row ──────────────────────────────────────────── */}
      <div className="opponent-row flex justify-evenly w-full px-4 pt-16 z-10 gap-3 shrink-0">
        {opponents.map(p => {
          const isActive   = p.isCurrentTurn;
          const isBotActive= isActive && p.isBot;
          return (
            <motion.div key={p.username}
              animate={isActive && animationsEnabled
                ? { scale: [1, 1.05, 1], transition: { duration: 1.8, repeat: Infinity } }
                : { scale: 1 }}
              className="relative flex flex-col items-center px-4 py-3 rounded-2xl shrink-0"
              style={{
                background:     isActive ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(12px)',
                outline:        isActive ? `2px solid ${ringColor}` : '2px solid rgba(255,255,255,0.1)',
                boxShadow:      isActive ? `0 0 25px ${ringColor}55` : 'none',
                minWidth:       '72px',
              }}
            >
              {/* Spinning conic ring (active) */}
              {isActive && animationsEnabled && (
                <div className="absolute -inset-[3px] rounded-2xl pointer-events-none"
                     style={{ background: `conic-gradient(${ringColor}, transparent, ${ringColor})`,
                              animation: 'spin 3s linear infinite', opacity: 0.35 }} />
              )}

              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black mb-1 z-10"
                   style={{ background: 'var(--accent-1)', color: 'var(--bg-primary)' }}>
                {p.username[0]}
              </div>
              <div className="text-xs font-bold text-white/80 uppercase tracking-wider z-10 text-center"
                   style={{ maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.username}
              </div>

              {/* Mini fanned cards */}
              <div className="flex items-center my-1 z-10" style={{ height: 32 }}>
                {Array.from({ length: Math.min(p.cardCount, 7) }).map((_, i, arr) => {
                  const mid = (arr.length - 1) / 2;
                  return (
                    <div key={i} className="absolute"
                         style={{
                           width: '16px', height: '26px',
                           background: 'linear-gradient(145deg, #c0392b, #7b241c)',
                           borderRadius: '3px', border: '1px solid rgba(255,255,255,0.4)',
                           transform: `rotate(${(i - mid) * 8}deg) translateX(${(i - mid) * 9}px)`,
                           boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                         }} />
                  );
                })}
              </div>

              <div className="text-xs font-black z-10" style={{ color: 'var(--accent-1)' }}>
                {p.cardCount} {p.cardCount === 1 ? 'card' : 'cards'}
              </div>

              {/* UNO indicator */}
              {p.cardCount === 1 && p.calledUno && (
                <span className="text-[10px] font-black text-yellow-300 animate-pulse z-10">UNO!</span>
              )}

              {/* Thinking indicator */}
              {isActive && (isBotActive
                ? <BotThinking color={ringColor} />
                : <span className="text-[10px] font-black uppercase tracking-widest animate-pulse mt-1 z-10"
                         style={{ color: ringColor }}>THINKING…</span>
              )}

              {/* Emoji reactions */}
              <div className="absolute -top-2 w-full flex justify-center pointer-events-none z-20">
                <AnimatePresence>
                  {reactions.filter(r => r.username === p.username).map(r => (
                    <motion.div key={r.id}
                      initial={{ y: 10, scale: 0, opacity: 0 }}
                      animate={{ y: -50, scale: 2, opacity: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="absolute text-3xl">
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
        <div className="absolute inset-0 m-auto rounded-full pointer-events-none"
             style={{ width: 420, height: 280,
                      background: 'radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 75%)' }} />

        {/* Direction indicator */}
        <div className="absolute top-6 text-3xl opacity-25 select-none"
             style={{ animation: direction === 1 ? 'spin 5s linear infinite' : 'spin 5s linear infinite reverse' }}>
          {direction === 1 ? '↻' : '↺'}
        </div>

        <div className="center-gap flex gap-14 items-center">
          {/* Deck / Pass */}
          {isMyTurn && hasDrawnThisTurn ? (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
                           onClick={() => socket.emit('pass_turn')}>
              <div className="w-24 h-36 rounded-2xl flex items-center justify-center font-black text-lg text-white/80 uppercase tracking-widest text-center leading-tight"
                   style={{ background: 'linear-gradient(135deg, #374151, #1f2937)',
                            border: '3px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
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
                width: 100, height: 146,
                background:  'linear-gradient(145deg, #1a0a20, #0d0d14)',
                border:      '3px solid rgba(255,255,255,0.15)',
                boxShadow:   isMyTurn ? '0 0 20px var(--accent-glow), 0 8px 24px rgba(0,0,0,0.5)' : 'none',
              }}
            >
              <div className="absolute inset-2 rounded-xl flex items-center justify-center overflow-hidden"
                   style={{ background: 'linear-gradient(145deg, #c0392b, #7b241c)' }}>
                <span className="font-display text-4xl italic text-white/20 -rotate-[30deg]" style={{ userSelect: 'none' }}>UNO</span>
              </div>
              <div className="absolute -bottom-6 w-full text-center text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {deckCount} left
              </div>
            </motion.div>
          )}

          {/* Discard pile with glow ring */}
          <div className="relative">
            <AnimatePresence>
              <div className="absolute -inset-4 rounded-2xl pointer-events-none"
                   style={{ border: `3px solid ${ringColor}`, boxShadow: `0 0 30px ${ringColor}55`,
                            animation: 'ringPulse 1.8s ease-in-out infinite', '--ring-color': ringColor }} />
              <DrawStackBadge count={drawStack} type={drawStackType} />
            </AnimatePresence>
            {topCard && <Card card={topCard} className="!border-4 !border-white/80" />}
          </div>
        </div>

        {/* Catch UNO + UNO button row */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {/* Catch UNO button */}
          <AnimatePresence>
            {catchTarget && (
              <motion.button
                key="catch"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400 } }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => socket.emit('catch_uno', { targetUsername: catchTarget })}
                className="catch-uno-btn px-6 py-2 text-sm font-black uppercase tracking-widest"
              >
                👀 CATCH {catchTarget}! (+2)
              </motion.button>
            )}
          </AnimatePresence>

          {/* Personal UNO button */}
          <AnimatePresence>
            {myHand.length <= 2 && (
              <motion.button key="uno-btn"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                onClick={() => socket.emit('call_uno')}
                className="font-black text-3xl italic px-12 py-4 rounded-full border-4"
                style={{
                  background: '#f56462', borderColor: 'rgba(255,255,255,0.3)', color: 'white',
                  boxShadow: '0 0 30px rgba(245,100,98,0.7), 0 0 60px rgba(245,100,98,0.3)',
                  animation: 'glowPulse 1.2s ease-in-out infinite',
                }}>
                UNO!
              </motion.button>
            )}
          </AnimatePresence>

          {/* Reactions */}
          <div className="flex gap-2 px-4 py-2 rounded-full"
               style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {['👍','😂','🔥','😡','💀'].map(emoji => (
              <motion.button key={emoji} whileHover={{ scale: 1.25 }} whileTap={{ scale: 0.85 }}
                             onClick={() => socket.emit('reaction', emoji)} className="text-2xl">
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* ── My Hand ────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center pb-4 shrink-0 relative z-10">
        {/* Timer */}
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
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.9 }}
              className="absolute -top-24 flex gap-3 px-5 py-4 rounded-2xl"
              style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.2)',
                       backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            >
              {['red','blue','green','yellow'].map(c => (
                <motion.button key={c} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                  onClick={() => handleColorSelect(c)}
                  className="w-11 h-11 rounded-full"
                  style={{ background: COLOR_RING[c], boxShadow: `0 0 14px ${COLOR_RING[c]}`,
                           border: '2px solid rgba(255,255,255,0.5)' }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort toggle + hand */}
        <div className="w-full flex flex-col items-center gap-1">
          {/* Sort button */}
          <div className="flex gap-2 items-center mb-1">
            <button
              onClick={() => updateSetting('autoSort', !autoSort)}
              className="text-xs px-3 py-1 rounded-full font-bold transition-all"
              style={{
                background: autoSort ? 'var(--glass-bg)' : 'rgba(255,255,255,0.05)',
                border:     `1px solid ${autoSort ? 'var(--accent-1)' : 'rgba(255,255,255,0.12)'}`,
                color:      autoSort ? 'var(--accent-1)' : 'rgba(255,255,255,0.4)',
                boxShadow:  autoSort ? '0 0 8px var(--accent-glow)' : 'none',
              }}
            >
              🔀 {autoSort ? 'Sorted' : 'Manual'}
            </button>
          </div>

          {/* Horizontal scrollable hand with LayoutGroup for animated reorder */}
          <LayoutGroup>
            <div className="hand-scroll w-full" style={{ maxWidth: '100vw' }}>
              <AnimatePresence>
                {displayHand.map((c, i) => {
                  const playable = isCardPlayable(c);
                  return (
                    <Card
                      key={c.id}
                      card={c}
                      isPlayable={playable}
                      isHighlighted={isMyTurn && playable && !pendingWildCardId}
                      onClick={() => handlePlayCard(c)}
                      arcIndex={i}
                      arcTotal={displayHand.length}
                      isInHand={true}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>

        {/* Player label */}
        <motion.div
          animate={{ color: isMyTurn ? 'var(--accent-1)' : 'white' }}
          transition={{ duration: 0.4 }}
          className="mt-3 px-8 py-2 rounded-full font-black tracking-widest text-base"
          style={{
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
            boxShadow:  isMyTurn ? '0 0 15px var(--accent-glow)' : 'none',
            transition: 'box-shadow 0.4s ease',
          }}
        >
          {username} — YOU {myHand.length === 1 ? '⚡ UNO!' : `(${myHand.length})`}
        </motion.div>
      </div>

      {/* ── Game Log ──────────────────────────────────────────────── */}
      <div className="game-log absolute bottom-4 left-4 w-56 max-h-40 overflow-y-auto p-3 rounded-2xl pointer-events-none text-xs space-y-1"
           style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
        <AnimatePresence initial={false}>
          {messages.slice(-6).map((m, i) => (
            <motion.div key={m.text + i}
              initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }}
              className="font-medium leading-tight"
              style={{ color: m.type === 'chaos' ? '#e879f9' : m.type === 'alert' ? '#f87171'
                             : m.type === 'safe' ? '#4ade80' : 'rgba(255,255,255,0.65)' }}>
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── UNO Flash Alert ───────────────────────────────────────── */}
      <AnimatePresence>
        {unoAlertPlayer && (
          <motion.div
            initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-[200]"
            style={{ background: 'radial-gradient(ellipse, rgba(245,100,98,0.25) 0%, transparent 70%)' }}
          >
            <h1 className="font-display text-[8rem] italic -rotate-12 drop-shadow-2xl text-center"
                style={{ color: '#f56462', textShadow: '0 0 60px rgba(245,100,98,0.9)', WebkitTextStroke: '2px white' }}>
              {unoAlertPlayer}<br/>UNO!
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings Panel ────────────────────────────────────────── */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
