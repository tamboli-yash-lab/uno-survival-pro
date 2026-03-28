import React, { useState, useEffect } from 'react';
import { useGameStore, socket } from '../store/gameStore.js';
import { rtcManager } from '../lib/webrtc.js';
import { audioManager } from '../lib/audioManager.js';
import Card from './Card.jsx';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameView() {
    const { 
        players, myHand, topCard, currentColor, direction, 
        deckCount, turnTimeLeft, messages, username, isHost, hasDrawnThisTurn
    } = useGameStore();
    
    const [selectedColor, setSelectedColor] = useState(null);
    const [pendingWildCardId, setPendingWildCardId] = useState(null);
    const [shake, setShake] = useState(false);
    const [unoAlertPlayer, setUnoAlertPlayer] = useState(null);
    const [reactions, setReactions] = useState([]);
    const [muted, setMuted] = useState(audioManager.muted);

    const { gameState, rankings } = useGameStore();

    useEffect(() => {
        const handleUno = (name) => {
            setUnoAlertPlayer(name);
            setTimeout(() => setUnoAlertPlayer(null), 2000);
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

    // Audio / Voice Chat logic
    useEffect(() => {
        players.forEach(p => {
             if (p.username !== username && p.socketId) {
                  rtcManager.connectToPeer(p.username, p.socketId);
             }
        });
    }, [players, username]);

    // Handle new messages for effects
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
             if (lastMsg.type === 'chaos') setShake(true);
             if (lastMsg.type === 'safe') {
                 confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }});
             }
             if (lastMsg.type === 'loser' || lastMsg.type === 'safe') {
                 audioManager.playCurrent('win');
             }
             setTimeout(() => setShake(false), 800);
        }
    }, [messages]);

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
        setSelectedColor(null);
    };

    const isMyTurn = players.find(p => p.username === username)?.isCurrentTurn;

    return (
        <div className={`w-full h-screen p-4 flex flex-col justify-between overflow-hidden relative ${shake ? 'animate-wiggle' : ''}`}>
             
             <button onClick={() => setMuted(audioManager.toggleMute())} className="absolute top-4 right-4 z-50 text-white/50 hover:text-white bg-black/50 p-2 rounded-full border border-white/20 text-2xl">
                 {muted ? '🔇' : '🔊'}
             </button>
             
             {/* Opponents Top Bar (Simulated Across the Table) */}
             <div className="flex justify-evenly flex-wrap w-full px-4 pt-4 z-0 gap-4">
                 {players.filter(p => p.username !== username).map(p => (
                     <div key={p.username} 
                        className={`flex flex-col items-center bg-black/60 px-6 py-4 rounded-3xl border-2 backdrop-blur-md transition-all
                           ${p.isCurrentTurn ? 'border-uno-yellow scale-110 shadow-[0_0_30px_#ffaa00] z-20' : 'border-white/10 opacity-80'}
                        `}>
                         <div className="text-sm text-gray-300 font-bold mb-2 uppercase">{p.username}</div>
                         
                         {/* Show Hidden Card Backs representing their hand */}
                         <div className="flex -space-x-4 mb-2">
                             {Array.from({ length: Math.min(p.cardCount, 6) }).map((_, i) => (
                                 <div key={i} className={`w-8 h-12 bg-uno-red rounded border border-white/50 shadow-md flex items-center justify-center transform ${i%2===0?'-rotate-6':'rotate-3'}`}>
                                     <span className="text-white/30 font-black text-[8px] -rotate-45">UNO</span>
                                 </div>
                             ))}
                             {p.cardCount > 6 && <div className="ml-4 bg-black/80 text-white rounded-full px-2 py-1 text-xs font-bold border border-white/20">+{p.cardCount - 6}</div>}
                         </div>
                         {p.isCurrentTurn && <span className="text-uno-yellow font-black text-xs animate-pulse tracking-widest mt-1">THINKING...</span>}
                         
                         {/* Reactions */}
                         <div className="absolute top-0 w-full flex justify-center pointer-events-none z-50">
                              <AnimatePresence>
                                  {reactions.filter(r => r.username === p.username).map(r => (
                                      <motion.div key={r.id} initial={{ y: 20, opacity: 0, scale: 0 }} animate={{ y: -60, opacity: 1, scale: 2 }} exit={{ opacity: 0 }} className="absolute text-4xl drop-shadow-lg">
                                          {r.emoji}
                                      </motion.div>
                                  ))}
                              </AnimatePresence>
                         </div>
                     </div>
                 ))}
             </div>

             {/* Center Table */}
             <div className="flex-1 flex flex-col items-center justify-center relative">
                  
                  {direction === 1 ? 
                      <div className="absolute top-10 text-4xl animate-spin-slow opacity-20">↻</div> : 
                      <div className="absolute top-10 text-4xl animate-[spin_3s_linear_infinite_reverse] opacity-20">↺</div>
                  }

                  <div className="flex gap-12 items-center">
                       {/* Deck or Pass Turn */}
                       {isMyTurn && hasDrawnThisTurn ? (
                           <button onClick={() => socket.emit('pass_turn')} 
                               className="relative cursor-pointer hover:scale-105 active:scale-95 transition-transform group">
                               <div className="w-32 h-48 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 border-4 border-gray-500 shadow-2xl flex items-center justify-center overflow-hidden">
                                   <span className="text-white font-black text-2xl uppercase tracking-widest text-center px-4 group-hover:text-red-400 transition-colors drop-shadow-lg">PASS<br/>TURN</span>
                               </div>
                           </button>
                       ) : (
                           <div className={`relative ${isMyTurn && !hasDrawnThisTurn ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : 'opacity-80'}`}
                                onClick={() => isMyTurn && !hasDrawnThisTurn && socket.emit('draw_card')}>
                                <div className="w-32 h-48 rounded-2xl bg-black border-4 border-white/20 flex items-center justify-center shadow-2xl relative">
                                    <div className="absolute inset-2 border-2 border-red-500 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center overflow-hidden">
                                         <span className="text-white/20 font-black text-6xl italic -rotate-45">UNO</span>
                                    </div>
                                </div>
                                <div className="absolute -bottom-6 text-center w-full font-bold opacity-70 bg-black/50 rounded-full">{deckCount}</div>
                           </div>
                       )}

                       {/* Discard Pile */}
                       <div className="relative">
                           <Card card={topCard} className="w-32 h-48 border-8 !border-white/90 shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                           {currentColor && topCard?.color === 'black' && (
                               <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full border-4 border-white shadow-lg"
                                    style={{ backgroundColor: currentColor === 'red' ? '#cc0000' : currentColor === 'blue' ? '#0055aa' : currentColor === 'green' ? '#55aa55' : '#ffaa00' }} />
                           )}
                       </div>
                  </div>

                  {/* UNO Call Button & Reaction Toolbar */}
                  <div className="mt-12 flex flex-col items-center gap-4">
                      {myHand.length <= 2 && (
                          <button 
                             onClick={() => socket.emit('call_uno')}
                             className="bg-uno-red hover:bg-red-500 text-white font-black text-3xl italic px-12 py-4 rounded-full border-4 border-white/20 shadow-[0_0_20px_rgba(245,100,98,0.6)] hover:scale-110 active:scale-90 transition-all">
                              UNO!
                          </button>
                      )}
                      <div className="flex gap-2 bg-black/50 px-4 py-2 rounded-full border border-white/10">
                          {['👍', '😂', '🔥', '😡', '💀'].map(emoji => (
                              <button key={emoji} onClick={() => socket.emit('reaction', emoji)} className="text-2xl hover:scale-125 transition-transform active:scale-90">{emoji}</button>
                          ))}
                      </div>
                  </div>
             </div>

             {/* My Player Hand */}
             <div className="flex flex-col items-center pb-8 shrink-0 relative z-10">
                 
                 {isMyTurn && turnTimeLeft !== null && (
                     <div className={`absolute -top-16 font-black text-3xl px-8 py-3 rounded-full shadow-2xl transition-all
                         ${turnTimeLeft <= 3 ? 'bg-red-600 text-white animate-pulse ring-8 ring-red-500/50 scale-125 shadow-[0_0_30px_red]' : 'bg-white text-black shadow-[0_0_20px_white]'}
                     `}>
                         {turnTimeLeft}s
                     </div>
                 )}

                 {pendingWildCardId && (
                     <div className="absolute -top-24 flex gap-4 bg-black/80 p-4 rounded-3xl backdrop-blur-xl border border-white/20 shadow-2xl">
                          <button onClick={() => handleColorSelect('red')} className="w-12 h-12 bg-uno-red rounded-full hover:scale-110 transition"></button>
                          <button onClick={() => handleColorSelect('blue')} className="w-12 h-12 bg-uno-blue rounded-full hover:scale-110 transition"></button>
                          <button onClick={() => handleColorSelect('green')} className="w-12 h-12 bg-uno-green rounded-full hover:scale-110 transition"></button>
                          <button onClick={() => handleColorSelect('yellow')} className="w-12 h-12 bg-uno-yellow rounded-full hover:scale-110 transition"></button>
                     </div>
                 )}

                 <div className={`flex flex-wrap justify-center gap-2 max-w-5xl transition-all ${isMyTurn ? 'translate-y-0' : 'translate-y-4 opacity-70 grayscale-[20%]'}`}>
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
                 <div className="mt-4 font-black tracking-widest text-xl bg-black/50 px-8 py-2 rounded-full">
                     {username} (YOU)
                 </div>
             </div>

             {/* Log Overlay */}
             <div className="absolute bottom-4 left-4 w-64 max-h-48 overflow-y-auto bg-black/50 p-4 rounded-2xl pointer-events-none text-sm space-y-2 border border-white/10">
                   {messages.slice(-5).map((m, i) => (
                       <div key={i} className={`font-medium ${m.type==='chaos'?'text-fuchsia-400':m.type==='alert'?'text-red-400':m.type==='safe'?'text-green-400':'text-gray-300'}`}>
                           {m.text}
                       </div>
                   ))}
              </div>

              {/* UNO Flash Alert */}
              <AnimatePresence>
                  {unoAlertPlayer && (
                      <motion.div 
                         initial={{ scale: 3, opacity: 0 }} 
                         animate={{ scale: 1, opacity: 1 }} 
                         exit={{ scale: 0, opacity: 0 }}
                         className="absolute inset-0 m-auto w-full h-full flex items-center justify-center pointer-events-none z-50 text-center"
                      >
                           <h1 className="text-[12rem] font-black italic text-red-500 drop-shadow-[0_0_80px_red] -rotate-12 outline-white">{unoAlertPlayer}<br/>UNO!</h1>
                      </motion.div>
                  )}
              </AnimatePresence>

              {/* Post-Game Results Screen */}
              {gameState === 'END' && (
                  <div className="absolute inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md">
                      <motion.div initial={{ scale: 0, y: 50 }} animate={{ scale: 1, y: 0 }} className="bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-800 p-16 rounded-3xl border-8 border-white shadow-[0_0_80px_rgba(255,215,0,0.6)] text-center max-w-2xl w-full">
                           <h1 className="text-7xl font-black text-white italic drop-shadow-2xl mb-4 uppercase leading-tight">
                              {rankings[0]}<br/>WINS!
                           </h1>
                           <p className="text-2xl text-yellow-100 font-bold mb-12 bg-black/20 inline-block px-8 py-2 rounded-full">
                               Rankings: {rankings.join(' > ')}
                           </p>
                           {isHost ? (
                               <button onClick={() => socket.emit('return_to_lobby')} className="w-full bg-white text-black font-black text-3xl py-6 px-12 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                                   PLAY AGAIN
                               </button>
                           ) : (
                               <div className="text-white text-xl font-bold animate-pulse">Waiting for host to restart the lobby...</div>
                           )}
                      </motion.div>
                  </div>
              )}
        </div>
    );
}
