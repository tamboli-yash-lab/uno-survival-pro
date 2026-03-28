class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.muted = false;
        
        // Background music element
        this.bgm = new Audio('https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3'); // Lofi chill track
        this.bgm.loop = true;
        this.bgm.volume = 0.3;
        
        // Unlock audiocontext on first interaction
        const unlock = () => {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            document.removeEventListener('click', unlock);
        };
        document.addEventListener('click', unlock);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.bgm.pause();
        } else {
            if (this.bgm.currentTime > 0) this.bgm.play().catch(()=>{});
        }
        return this.muted;
    }

    playBGM() {
        if (!this.muted) {
            this.bgm.play().catch(e => console.log('Audio autoplay prevented'));
        }
    }

    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    }

    playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
        if (this.muted || this.ctx.state === 'suspended') return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playCurrent(sound) {
        if (this.muted) return;
        switch (sound) {
            case 'draw':
                this.playTone(400, 'triangle', 0.1, 0.1);
                setTimeout(() => this.playTone(500, 'triangle', 0.15, 0.1), 50);
                break;
            case 'play':
                this.playTone(600, 'square', 0.1, 0.05);
                break;
            case 'uno':
                this.playTone(880, 'sine', 0.4, 0.2);
                setTimeout(() => this.playTone(1760, 'sine', 0.6, 0.2), 100);
                break;
            case 'error':
                this.playTone(150, 'sawtooth', 0.3, 0.2);
                break;
            case 'win':
                [440, 554, 659, 880].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 'sine', 1.0, 0.2), i * 150);
                });
                break;
        }
    }
}

export const audioManager = new AudioManager();
