import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { audioManager } from '../lib/audioManager.js';

// ─── Theme Swatches ──────────────────────────────────────────────────────────
const THEMES = [
  { id: 'theme-neon',    label: 'Neon Cyberpunk', colors: ['#9b59ff','#00c3ff'] },
  { id: 'theme-classic', label: 'Classic UNO',    colors: ['#f56462','#0055aa'] },
  { id: 'theme-dark',    label: 'Dark Void',       colors: ['#333','#111'] },
  { id: 'theme-forest',  label: 'Forest',          colors: ['#00e676','#00bcd4'] },
  { id: 'theme-ocean',   label: 'Deep Ocean',      colors: ['#00b4d8','#90e0ef'] },
  { id: 'theme-sunset',  label: 'Sunset',          colors: ['#ff8c00','#ff2d78'] },
];

const BGM_TRACKS = [
  { id: 'lofi',  label: '🎵 Lofi Chill' },
  { id: 'epic',  label: '⚡ Epic Battle' },
  { id: 'chill', label: '🌙 Ambient Chill' },
  { id: 'off',   label: '🔇 Off' },
];

const FONTS = ['Inter', 'Poppins', 'Bebas Neue'];

const CARD_SIZES = [
  { id: 'sm', label: 'Small'  },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large'  },
];

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5">
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-white/50">{title}</span>
      <div className="flex-1 h-px bg-white/10 ml-2" />
    </div>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-white/80">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none"
        style={{
          background: value
            ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))'
            : 'rgba(255,255,255,0.15)',
          boxShadow: value ? '0 0 12px var(--accent-glow)' : 'none',
        }}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300"
          style={{ left: value ? '28px' : '4px' }}
        />
      </button>
    </div>
  );
}

// ─── Slider ──────────────────────────────────────────────────────────────────
function Slider({ value, onChange, label, min = 0, max = 100, unit = '%' }) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white/80">{label}</span>
        <span className="text-xs font-bold" style={{ color: 'var(--accent-1)' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent-1) ${value}%, rgba(255,255,255,0.15) ${value}%)`,
        }}
      />
    </div>
  );
}

// ─── Main Settings Panel ─────────────────────────────────────────────────────
export default function SettingsPanel({ onClose }) {
  const store = useGameStore();
  const {
    theme, cardGlow, animationsEnabled, sfxVolume, bgmVolume,
    bgmTrack, cardSize, confettiEnabled, font, bgStyle, updateSetting,
  } = store;

  const set = (key, value) => {
    updateSetting(key, value);
    // Apply audio volumes immediately
    if (key === 'sfxVolume') audioManager.setSfxVolume(value / 100);
    if (key === 'bgmVolume') audioManager.setBgmVolume(value / 100);
    if (key === 'bgmTrack')  audioManager.setBgmTrack(value);
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="settings-backdrop"
        className="settings-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Panel */}
      <motion.div
        key="settings-panel"
        className="settings-panel"
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 sticky top-0 z-10"
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--glass-border)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div>
            <h2 className="text-xl font-black text-white tracking-wide">Settings</h2>
            <p className="text-xs text-white/40 mt-0.5">Your preferences are saved automatically</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white transition"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            ✕
          </button>
        </div>

        <div className="px-6 pb-10">

          {/* ── Theme ─────────────────────────────────────── */}
          <SectionHeader icon="🎨" title="Theme" />
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => set('theme', t.id)}
                className="relative p-3 rounded-xl text-left transition-all"
                style={{
                  background:  theme === t.id
                    ? `linear-gradient(135deg, ${t.colors[0]}22, ${t.colors[1]}22)`
                    : 'rgba(255,255,255,0.05)',
                  border: theme === t.id
                    ? `2px solid ${t.colors[0]}`
                    : '2px solid rgba(255,255,255,0.1)',
                  boxShadow: theme === t.id ? `0 0 14px ${t.colors[0]}55` : 'none',
                }}
              >
                <div className="flex gap-1.5 mb-1.5">
                  {t.colors.map((c, i) => (
                    <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-xs font-semibold text-white/80">{t.label}</span>
                {theme === t.id && (
                  <span className="absolute top-2 right-2 text-xs"
                        style={{ color: t.colors[0] }}>✓</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Card Size ─────────────────────────────────── */}
          <SectionHeader icon="🃏" title="Card Size" />
          <div className="flex gap-2">
            {CARD_SIZES.map(s => (
              <button
                key={s.id}
                onClick={() => set('cardSize', s.id)}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: cardSize === s.id
                    ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))'
                    : 'rgba(255,255,255,0.07)',
                  color:      cardSize === s.id ? 'white' : 'rgba(255,255,255,0.6)',
                  border:     cardSize === s.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow:  cardSize === s.id ? '0 0 12px var(--accent-glow)' : 'none',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Visual FX ─────────────────────────────────── */}
          <SectionHeader icon="✨" title="Visual Effects" />
          <Toggle value={cardGlow}          onChange={v => set('cardGlow', v)}          label="Card Glow Shadows" />
          <Toggle value={animationsEnabled} onChange={v => set('animationsEnabled', v)} label="Animations & Transitions" />
          <Toggle value={confettiEnabled}   onChange={v => set('confettiEnabled', v)}   label="Confetti on Events" />

          {/* ── Sound FX ──────────────────────────────────── */}
          <SectionHeader icon="🔊" title="Sound Effects" />
          <Slider
            label="SFX Volume"
            value={sfxVolume}
            onChange={v => set('sfxVolume', v)}
          />

          {/* ── Music ─────────────────────────────────────── */}
          <SectionHeader icon="🎵" title="Background Music" />
          <Slider
            label="Music Volume"
            value={bgmVolume}
            onChange={v => set('bgmVolume', v)}
          />
          <div className="grid grid-cols-2 gap-2 mt-2">
            {BGM_TRACKS.map(t => (
              <button
                key={t.id}
                onClick={() => set('bgmTrack', t.id)}
                className="py-2 px-3 rounded-xl text-xs font-bold transition-all text-center"
                style={{
                  background: bgmTrack === t.id
                    ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))'
                    : 'rgba(255,255,255,0.07)',
                  color:     bgmTrack === t.id ? 'white' : 'rgba(255,255,255,0.6)',
                  border:    bgmTrack === t.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: bgmTrack === t.id ? '0 0 10px var(--accent-glow)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Font ──────────────────────────────────────── */}
          <SectionHeader icon="🔤" title="Font Style" />
          <div className="flex flex-col gap-2">
            {FONTS.map(f => (
              <button
                key={f}
                onClick={() => set('font', f)}
                className="py-2.5 px-4 rounded-xl text-sm transition-all text-left"
                style={{
                  fontFamily: f,
                  background: font === f
                    ? 'linear-gradient(135deg, var(--accent-1)22, var(--accent-2)22)'
                    : 'rgba(255,255,255,0.05)',
                  border: font === f
                    ? '1px solid var(--accent-1)'
                    : '1px solid rgba(255,255,255,0.1)',
                  color:  font === f ? 'white' : 'rgba(255,255,255,0.6)',
                  boxShadow: font === f ? '0 0 10px var(--accent-glow)' : 'none',
                }}
              >
                {f} — <span className="opacity-60">The quick brown fox</span>
              </button>
            ))}
          </div>

        </div>{/* end scroll container */}
      </motion.div>
    </AnimatePresence>
  );
}
