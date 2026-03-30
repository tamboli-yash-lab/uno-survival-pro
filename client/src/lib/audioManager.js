class AudioManager {
    constructor() {
        this.ctx    = null;
        this.muted  = false;
        this._sfxVol = 0.7;
        this._bgmVol = 0.3;
        this._currentTrackUrl = 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3';

        this.bgm = new Audio(this._currentTrackUrl);
        this.bgm.loop   = true;
        this.bgm.volume = this._bgmVol;

        const initCtx = () => {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            document.removeEventListener('click', initCtx);
        };
        document.addEventListener('click', initCtx);
    }

    // ── Volume Controls ─────────────────────────────────────────────────────
    setSfxVolume(v) {
        this._sfxVol = Math.max(0, Math.min(1, v));
    }

    setBgmVolume(v) {
        this._bgmVol = Math.max(0, Math.min(1, v));
        this.bgm.volume = this._bgmVol;
    }

    setBgmTrack(track) {
        const tracks = {
            lofi:  'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
            epic:  'https://cdn.pixabay.com/audio/2023/06/22/audio_5588b7e90c.mp3',
            chill: 'https://cdn.pixabay.com/audio/2022/11/16/audio_e47b03a5df.mp3',
            off:   null,
        };
        const url = tracks[track];
        if (!url) { this.stopBGM(); return; }
        const wasPlaying = !this.bgm.paused;
        // Fade out, swap, fade in
        this.bgm.pause();
        this.bgm.src = url;
        this.bgm.load();
        if (wasPlaying && !this.muted) {
            this.bgm.play().catch(() => {});
        }
    }

    // ── Mute All ────────────────────────────────────────────────────────────
    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.bgm.pause();
        } else {
            this.bgm.play().catch(() => {});
        }
        return this.muted;
    }

    // ── BGM ─────────────────────────────────────────────────────────────────
    playBGM() {
        if (!this.muted) {
            this.bgm.play().catch(() => {});
        }
    }

    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    }

    // ── SFX Tones ───────────────────────────────────────────────────────────
    playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
        if (this.muted || !this.ctx || this.ctx.state === 'suspended') return;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        const v = vol * this._sfxVol;
        gain.gain.setValueAtTime(v, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration + 0.01);
    }

    playCurrent(sound) {
        if (this.muted) return;
        switch (sound) {
            case 'draw':
                this.playTone(400, 'triangle', 0.12, 0.1);
                setTimeout(() => this.playTone(520, 'triangle', 0.16, 0.1), 70);
                break;
            case 'play':
                this.playTone(660, 'square', 0.08, 0.07);
                setTimeout(() => this.playTone(880, 'square', 0.1, 0.07), 60);
                break;
            case 'uno':
                this.playTone(880, 'sine', 0.4, 0.25);
                setTimeout(() => this.playTone(1320, 'sine', 0.5, 0.2), 120);
                setTimeout(() => this.playTone(1760, 'sine', 0.6, 0.2), 240);
                break;
            case 'error':
                this.playTone(180, 'sawtooth', 0.3, 0.2);
                setTimeout(() => this.playTone(140, 'sawtooth', 0.3, 0.18), 100);
                break;
            case 'win':
                [440, 554, 659, 880, 1100].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 'sine', 0.8, 0.2), i * 140);
                });
                break;
            case 'chaos':
                [200, 160, 120].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 'sawtooth', 0.15, 0.3), i * 80);
                });
                break;
        }
    }
}

export const audioManager = new AudioManager();
