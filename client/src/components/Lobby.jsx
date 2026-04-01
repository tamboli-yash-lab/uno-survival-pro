import React, { useState, useEffect } from 'react';
import { useGameStore, socket } from '../store/gameStore.js';
import { rtcManager } from '../lib/webrtc.js';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsPanel from './SettingsPanel.jsx';

const RULE_OPTIONS = [
  { key: 'stackDrawCards',  label: '📚 Stack Draw Cards',   desc: '+2 stacks on +2, +4 stacks on +4' },
  { key: 'sevenZeroRule',   label: '🔄 7-0 Rule',           desc: '7=swap hands, 0=rotate all hands' },
  { key: 'jumpInRule',      label: '⚡ Jump-In',             desc: 'Same card can interrupt any turn' },
  { key: 'forcePlay',       label: '🎯 Force Play',          desc: 'Auto-play drawn card if valid' },
  { key: 'strictWildDraw4', label: '🚫 Strict Wild +4',     desc: 'Only legal if no matching colour' },
];

export default function Lobby() {
  const { players, username, isHost, roomId, setUsername, roomSettings } = useGameStore();
  const [nameInput,    setNameInput]    = useState('');
  const [roomInput,    setRoomInput]    = useState('');
  const [error,        setError]        = useState(null);
  const [mode,         setMode]         = useState('CREATE');
  const [showSettings, setShowSettings] = useState(false);
  const [showRules,    setShowRules]    = useState(false);

  useEffect(() => {
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom) { setRoomInput(urlRoom.toUpperCase()); setMode('JOIN'); }
  }, []);

  const handleAction = async (e) => {
    e.preventDefault();
    setError(null);
    if (!nameInput.trim()) return setError('Name is required.');
    if (mode === 'JOIN' && !roomInput.trim()) return setError('Room code is required.');
    try { await rtcManager.init(); } catch {}
    setUsername(nameInput);
    if (mode === 'CREATE') {
      socket.emit('create_room', { username: nameInput });
    } else {
      socket.emit('join_lobby', { username: nameInput, roomId: roomInput.toUpperCase() });
    }
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`);
  };

  const toggleRule = (key) => {
    const newVal = !roomSettings[key];
    socket.emit('update_settings', { [key]: newVal });
  };

  // ── Floating settings gear ─────────────────────────────────────────────────
  const GearBtn = () => (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={() => setShowSettings(true)}
      className="fixed top-4 right-4 z-50 w-11 h-11 flex items-center justify-center rounded-full text-lg"
      style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      ⚙️
    </motion.button>
  );

  // ── Waiting room ───────────────────────────────────────────────────────────
  if (username && players.length > 0) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center p-4">
        <GearBtn />
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl glass-panel rounded-3xl p-8 shadow-glass"
        >
          {/* Header */}
          <h1 className="text-4xl font-black italic text-center uppercase tracking-widest mb-2"
              style={{ color: 'var(--accent-1)', textShadow: '0 0 20px var(--accent-glow)' }}>
            UNO SURVIVAL
          </h1>
          <div className="flex justify-center mb-8">
            <span className="text-xl font-black tracking-[0.4em] px-8 py-2 rounded-full border"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)',
                           color: 'var(--accent-2)', boxShadow: '0 0 20px var(--accent-glow)' }}>
              ROOM: {roomId}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player list */}
            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-base font-bold text-white/60 uppercase tracking-widest mb-4">
                Players ({players.length}/7)
              </h2>
              <ul className="space-y-2">
                {players.map(p => (
                  <li key={p.id}
                      className="flex items-center justify-between rounded-xl px-4 py-3 transition-all"
                      style={{
                        background: p.username === username
                          ? 'linear-gradient(135deg, var(--accent-1)22, var(--accent-2)22)'
                          : 'rgba(255,255,255,0.04)',
                        border: p.username === username
                          ? '1px solid var(--accent-1)' : '1px solid rgba(255,255,255,0.07)',
                      }}>
                    <span className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                            style={{ background: 'var(--accent-1)', color: 'var(--bg-primary)' }}>
                        {p.username[0]}
                      </span>
                      <span className="font-semibold">{p.username}</span>
                      {p.isHost && <span className="text-[10px] bg-yellow-400 text-black px-2 py-0.5 rounded-full font-black">HOST</span>}
                      {p.isBot  && <span className="text-[10px] bg-purple-500 text-white  px-2 py-0.5 rounded-full font-black">BOT</span>}
                    </span>
                    {isHost && p.username !== username && (
                      <button onClick={() => socket.emit('kick_player', p.username)}
                              className="text-red-400 hover:text-red-300 text-xs font-bold">KICK</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Host controls */}
            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-base font-bold text-white/60 uppercase tracking-widest mb-4">
                {isHost ? 'Host Controls' : 'Waiting for host…'}
              </h2>
              {isHost ? (
                <div className="space-y-3">
                  <button onClick={handleCopyInvite} className="btn-glass w-full py-3 rounded-xl">
                    🔗 Copy Invite Link
                  </button>
                  <button onClick={() => socket.emit('add_bot')} className="btn-glass w-full py-3 rounded-xl"
                          style={{ borderColor: '#9b59ff' }}>
                    🤖 Add Bot
                  </button>

                  {/* ── Game Rules accordion ──────────────────────────────── */}
                  <button
                    onClick={() => setShowRules(v => !v)}
                    className="btn-glass w-full py-3 rounded-xl flex items-center justify-between px-4"
                  >
                    <span>⚖️ Game Rules</span>
                    <span className="text-white/50 text-sm">{showRules ? '▲' : '▼'}</span>
                  </button>

                  <AnimatePresence>
                    {showRules && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl p-4 space-y-3"
                             style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {RULE_OPTIONS.map(rule => (
                            <label key={rule.key}
                                   className="flex items-start justify-between gap-3 cursor-pointer py-1">
                              <div>
                                <div className="text-sm font-bold text-white">{rule.label}</div>
                                <div className="text-xs text-white/40">{rule.desc}</div>
                              </div>
                              <button
                                onClick={() => toggleRule(rule.key)}
                                className="relative w-12 h-6 rounded-full transition-all shrink-0 mt-0.5"
                                style={{
                                  background: roomSettings[rule.key]
                                    ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))'
                                    : 'rgba(255,255,255,0.15)',
                                  boxShadow: roomSettings[rule.key] ? '0 0 10px var(--accent-glow)' : 'none',
                                }}
                              >
                                <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                                      style={{ left: roomSettings[rule.key] ? '28px' : '4px' }} />
                              </button>
                            </label>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button onClick={() => socket.emit('start_game')} className="btn-neon w-full py-4 rounded-xl text-lg mt-2">
                    ▶ START SURVIVAL
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin"
                       style={{ borderColor: 'var(--accent-1)', borderTopColor: 'transparent' }} />
                  <p className="text-white/50 text-sm">Waiting for host to start…</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // ── Entry screen ───────────────────────────────────────────────────────────
  const floatingCards = [
    { color: '#f56462', top: '8%',   left: '5%',   rotate: -20, delay: 0   },
    { color: '#0055aa', top: '15%',  right: '6%',  rotate:  15, delay: 1   },
    { color: '#55aa55', bottom: '18%', left: '7%', rotate: -10, delay: 2   },
    { color: '#ffaa00', bottom: '10%', right: '8%',rotate:  25, delay: 0.5 },
    { color: '#9b59ff', top: '45%',  left: '2%',   rotate: -30, delay: 1.5 },
    { color: '#00c3ff', top: '40%',  right: '3%',  rotate:  12, delay: 2.5 },
  ];

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <GearBtn />

      {floatingCards.map((c, i) => (
        <div key={i} className="floating-card"
             style={{ width: 60, height: 88, background: c.color,
                      top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                      rotate: `${c.rotate}deg`, animationDelay: `${c.delay}s` }} />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm glass-panel-strong rounded-3xl p-8 shadow-glass relative z-10"
      >
        {/* Animated logo */}
        <div className="flex justify-center mb-8">
          {['U','N','O','!'].map((letter, i) => (
            <motion.span
              key={i}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}
              className="font-display text-6xl leading-none"
              style={{
                color: ['#f56462','#ffaa00','#55aa55','#0055aa'][i],
                textShadow: `0 0 20px ${ ['rgba(245,100,98,0.6)','rgba(255,170,0,0.6)','rgba(85,170,85,0.6)','rgba(0,85,170,0.6)'][i] }`,
              }}
            >
              {letter}
            </motion.span>
          ))}
        </div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.35em] text-white/40 mb-7 -mt-4">
          Survival Multiplayer
        </p>

        {/* Mode toggle */}
        <div className="flex rounded-xl mb-6 p-1"
             style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {['CREATE','JOIN'].map(m => (
            <button key={m} onClick={() => setMode(m)}
                    className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                    style={{
                      background: mode === m ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'transparent',
                      color:      mode === m ? 'white' : 'rgba(255,255,255,0.45)',
                      boxShadow:  mode === m ? '0 0 12px var(--accent-glow)' : 'none',
                    }}>
              {m === 'CREATE' ? 'Create Room' : 'Join Room'}
            </button>
          ))}
        </div>

        <form onSubmit={handleAction} className="space-y-4">
          {error && (
            <div className="text-sm p-3 rounded-xl"
                 style={{ background: 'rgba(245,100,98,0.15)', border: '1px solid rgba(245,100,98,0.4)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">Username</label>
            <input type="text" value={nameInput} maxLength={12}
                   onChange={e => setNameInput(e.target.value.toUpperCase())}
                   placeholder="ENTER NAME"
                   className="w-full px-4 py-3 rounded-xl text-white font-bold tracking-wider outline-none"
                   style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '1rem' }}
                   onFocus={e => { e.target.style.borderColor = 'var(--accent-1)'; e.target.style.boxShadow = '0 0 12px var(--accent-glow)'; }}
                   onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }} />
          </div>

          {mode === 'JOIN' && (
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-1.5">Room Code</label>
              <input type="text" value={roomInput} maxLength={6}
                     onChange={e => setRoomInput(e.target.value.toUpperCase())}
                     placeholder="XXXXXX"
                     className="w-full px-4 py-3 rounded-xl text-white font-black tracking-[0.6em] text-center outline-none"
                     style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '1.1rem' }}
                     onFocus={e => { e.target.style.borderColor = 'var(--accent-1)'; e.target.style.boxShadow = '0 0 12px var(--accent-glow)'; }}
                     onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }} />
            </div>
          )}

          <button type="submit" className="btn-neon w-full py-4 text-lg rounded-xl">
            {mode === 'CREATE' ? '🚀 Create Secure Lobby' : '🎮 Join Game'}
          </button>
        </form>
      </motion.div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
