import React, { useEffect } from 'react';
import { useGameStore, socket } from '../store/gameStore.js';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import SettingsPanel from './SettingsPanel.jsx';
import { useState } from 'react';

export default function EndScreen() {
  const { rankings, username, confettiEnabled } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (confettiEnabled && rankings[0]) {
      // Winner confetti burst
      setTimeout(() => {
        confetti({ particleCount: 250, spread: 100, origin: { y: 0.5 }, colors: ['#f56462','#ffaa00','#55aa55','#0055aa','#9b59ff'] });
      }, 400);
    }
  }, []);

  const positionMeta = (index, total) => {
    if (index === 0) return { icon: '🥇', label: 'CHAMPION', color: '#ffd700', glow: 'rgba(255,215,0,0.5)' };
    if (index === 1) return { icon: '🥈', label: '2nd Place', color: '#aaaaaa', glow: 'rgba(160,160,160,0.3)' };
    if (index === 2) return { icon: '🥉', label: '3rd Place', color: '#cd7f32', glow: 'rgba(205,127,50,0.3)' };
    if (index === total - 1) return { icon: '💀', label: 'ELIMINATED', color: '#ef4444', glow: 'rgba(239,68,68,0.4)' };
    return { icon: `${index + 1}`, label: `${index + 1}th Place`, color: 'rgba(255,255,255,0.5)', glow: 'transparent' };
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center p-4">
      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        className="fixed top-4 right-4 z-50 w-11 h-11 flex items-center justify-center rounded-full text-lg transition-all"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        ⚙️
      </button>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-2xl glass-panel-strong rounded-3xl p-10 text-center shadow-glass"
      >
        {/* Header */}
        <motion.h1
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="font-display text-7xl mb-2"
          style={{
            background: 'linear-gradient(135deg, #ffd700, #ff8c00, #f56462)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
            letterSpacing: '0.04em',
          }}
        >
          GAME OVER
        </motion.h1>
        <p className="text-sm font-bold uppercase tracking-[0.4em] text-white/40 mb-10">
          Survival Results
        </p>

        {/* Rankings */}
        <div className="w-full space-y-3 text-left">
          {rankings.map((playerStr, index) => {
            const meta = positionMeta(index, rankings.length);
            const isMe = playerStr === username;

            return (
              <motion.div
                key={index}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="flex items-center justify-between px-5 py-4 rounded-2xl transition-all"
                style={{
                  background: isMe
                    ? `linear-gradient(135deg, ${meta.color}22, ${meta.color}11)`
                    : 'rgba(255,255,255,0.04)',
                  border:     `2px solid ${isMe ? meta.color : 'rgba(255,255,255,0.08)'}`,
                  boxShadow:  isMe ? `0 0 20px ${meta.glow}` : 'none',
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl w-10 text-center">{meta.icon}</span>
                  <div>
                    <div className="font-black text-lg leading-tight">{playerStr}</div>
                    <div
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </div>
                  </div>
                  {isMe && (
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded"
                      style={{ background: meta.color, color: '#000' }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                <div
                  className="text-2xl"
                  style={{
                    filter: index === 0 ? 'drop-shadow(0 0 8px #ffd700)' : 'none',
                  }}
                >
                  {index === 0 ? '🏆' : index === rankings.length - 1 ? '❌' : ''}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Return button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={() => window.location.reload()}
          className="btn-neon mt-10 px-16 py-4 text-lg rounded-2xl"
        >
          🔄 Return to Lobby
        </motion.button>
      </motion.div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
