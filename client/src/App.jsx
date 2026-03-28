import { useEffect, useState } from 'react';
import { useGameStore, socket } from './store/gameStore.js';
import Lobby from './components/Lobby.jsx';
import GameView from './components/GameView.jsx';
import EndScreen from './components/EndScreen.jsx';
import { rtcManager } from './lib/webrtc.js';

function App() {
  const { gameState, theme, initSocket } = useGameStore();

  useEffect(() => {
    initSocket();
    
    const audioMap = {
        play: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_73da32cece.mp3?filename=card-deal-94262.mp3',
        draw: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_4eb6ebf676.mp3?filename=card-slide-10-104928.mp3',
        uno: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3'
    };
    
    // Background Music
    const bgm = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf589.mp3?filename=lofi-study-112191.mp3');
    bgm.loop = true;
    bgm.volume = 0.2;

    const playSound = (e) => {
        try {
            if (audioMap[e.detail]) {
                const a = new Audio(audioMap[e.detail]);
                a.volume = 0.6;
                a.play().catch(()=>{});
            }
        } catch(err) {}
    };

    const startAudio = () => {
        bgm.play().catch(()=>{});
        window.removeEventListener('click', startAudio);
    };

    window.addEventListener('play_sound', playSound);
    window.addEventListener('click', startAudio);

    return () => {
        window.removeEventListener('play_sound', playSound);
        window.removeEventListener('click', startAudio);
        bgm.pause();
        socket.disconnect();
        rtcManager.disconnectAll();
    };
  }, [initSocket]);

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center ${theme}`}>
       {gameState === 'LOBBY' && <Lobby />}
       {gameState === 'PLAYING' && <GameView />}
       {gameState === 'END' && <EndScreen />}
    </div>
  );
}

export default App;
