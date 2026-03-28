import React from 'react';
import { useGameStore } from '../store/gameStore.js';

export default function EndScreen() {
    const { rankings, username } = useGameStore();
    
    // rankings contains the ordered list of who finished first to last
    // The last person to finish (or the only one left) is the loser.
    
    return (
        <div className="w-full max-w-2xl bg-black/60 backdrop-blur-md border border-white/20 rounded-3xl p-10 m-4 shadow-2xl flex flex-col items-center text-center">
            
            <h1 className="text-6xl font-black italic mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 py-2">
                GAME OVER
            </h1>
            <p className="text-xl text-gray-300 mb-10 font-bold uppercase tracking-widest">Survival Results</p>
            
            <div className="w-full space-y-4">
                {rankings.map((playerStr, index) => {
                    const isLoser = index === rankings.length - 1;
                    const isMe = playerStr === username;
                    
                    let positionIcon = '';
                    let positionColor = '';
                    
                    if (index === 0) { positionIcon = '🥇'; positionColor = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'; }
                    else if (index === 1) { positionIcon = '🥈'; positionColor = 'text-gray-300 bg-gray-300/10 border-gray-300/30'; }
                    else if (index === 2) { positionIcon = '🥉'; positionColor = 'text-amber-600 bg-amber-600/10 border-amber-600/30'; }
                    else if (isLoser) { positionIcon = '❌'; positionColor = 'text-red-500 bg-red-500/10 border-red-500/50 scale-105 shadow-[0_0_20px_rgba(255,0,0,0.3)]'; }
                    else { positionIcon = `${index + 1}th`; positionColor = 'text-white bg-white/5 border-white/10'; }

                    return (
                        <div key={index} 
                             className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${positionColor} ${isMe ? 'ring-2 ring-white/50' : ''}`}>
                            <div className="flex items-center gap-4">
                                <span className="text-3xl w-10 text-center">{positionIcon}</span>
                                <span className="text-2xl font-black tracking-wide">{playerStr}</span>
                                {isMe && <span className="text-xs bg-white text-black px-2 py-1 rounded font-bold ml-2">YOU</span>}
                            </div>
                            <div className="font-bold opacity-80 uppercase tracking-wider text-sm">
                                {isLoser ? "ELIMINATED (LOSER)" : "SURVIVED (SAFE)"}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <button 
                onClick={() => window.location.reload()} 
                className="mt-12 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold py-4 px-12 rounded-xl transition-all hover:scale-105 active:scale-95">
                RETURN TO LOBBY
            </button>
        </div>
    );
}
