import React, { useState, useEffect } from 'react';
import { useGameStore, socket } from '../store/gameStore.js';
import { rtcManager } from '../lib/webrtc.js';

export default function Lobby() {
    const { players, username, isHost, tokens = {}, roomId, setUsername } = useGameStore();
    const [nameInput, setNameInput] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [error, setError] = useState(null);
    const [micEnabled, setMicEnabled] = useState(false);
    
    // Determine initial mode based on URL
    const [mode, setMode] = useState('CREATE'); // 'CREATE' or 'JOIN'

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlRoom = urlParams.get('room');
        if (urlRoom) {
            setRoomInput(urlRoom.toUpperCase());
            setMode('JOIN');
        }
    }, []);

    const handleAction = async (e) => {
        e.preventDefault();
        setError(null);
        if(!nameInput.trim()) return setError("Name is required.");
        if(mode === 'JOIN' && !roomInput.trim()) return setError("Room ID is required.");
        
        try {
           const mic = await rtcManager.init();
           setMicEnabled(mic);
        } catch(err) {
           console.warn("Mic not available", err);
        }

        setUsername(nameInput);
        if (mode === 'CREATE') {
            socket.emit('create_room', { username: nameInput });
        } else {
            socket.emit('join_lobby', { username: nameInput, roomId: roomInput.toUpperCase() });
        }
    };

    const handleCopyInvite = () => {
        const url = `${window.location.origin}/?room=${roomId}`;
        navigator.clipboard.writeText(url);
        alert("Invite Link Copied!");
    };

    const handleAddBot = () => {
        socket.emit('add_bot');
    };

    const handleStartGame = () => {
        socket.emit('start_game');
    };

    if (username && players.length > 0) {
        return (
            <div className="w-full max-w-4xl bg-black/40 backdrop-blur border flex flex-col border-white/10 rounded-3xl p-8 m-4 shadow-2xl">
                 <h1 className="text-4xl font-black italic text-center text-uno-yellow drop-shadow-lg mb-4 uppercase tracking-widest">
                    UNO SURVIVAL LOBBY
                 </h1>
                 <p className="text-center text-xl text-white font-black tracking-[0.3em] mb-8 bg-black/50 py-2 rounded-xl mx-auto px-8 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                    ROOM: {roomId}
                 </p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-white/5 rounded-xl p-6">
                         <h2 className="text-xl font-bold mb-4">Players ({players.length}/7)</h2>
                         <ul className="space-y-3">
                             {players.map(p => (
                                 <li key={p.id} className="flex items-center justify-between bg-black/30 p-3 rounded-lg">
                                     <span className="font-medium flex items-center gap-3">
                                         {p.username}
                                         {p.isHost && <span className="text-xs bg-uno-yellow text-black px-2 py-1 rounded-full font-bold">HOST</span>}
                                         {p.isBot && <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full font-bold">BOT</span>}
                                         {p.status === 'OFFLINE' && <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">OFFLINE</span>}
                                     </span>
                                     {isHost && p.username !== username && (
                                         <button 
                                            onClick={() => socket.emit('kick_player', p.username)}
                                            className="text-red-400 hover:text-red-300 text-sm font-bold"
                                         >KICK</button>
                                     )}
                                 </li>
                             ))}
                         </ul>
                     </div>

                     <div className="bg-white/5 rounded-xl p-6">
                         <h2 className="text-xl font-bold mb-4">Host Dashboard</h2>
                         {isHost ? (
                             <div className="space-y-4">
                                 <button onClick={handleCopyInvite} className="w-full bg-uno-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition shadow">
                                     Copy Invite Link
                                 </button>
                                 <button onClick={handleAddBot} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition shadow">
                                     Add Bot Layer
                                 </button>
                                 <button onClick={handleStartGame} className="w-full mt-4 bg-uno-green hover:bg-green-500 text-white font-black py-4 rounded-xl text-xl shadow-lg transition">
                                     START SURVIVAL
                                 </button>
                             </div>
                         ) : (
                             <div className="text-center text-gray-400 py-10">
                                 Waiting for host to configure game and start...
                             </div>
                         )}
                     </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md bg-black/40 backdrop-blur border border-white/10 rounded-3xl p-8 m-4 shadow-2xl">
            <h1 className="text-5xl font-black italic text-center mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] tracking-widest">
                <span className="text-uno-red">U</span>
                <span className="text-uno-blue">N</span>
                <span className="text-uno-yellow">O</span>
                <span className="text-uno-green">!</span>
            </h1>
            
            <div className="flex bg-black/50 p-1 rounded-xl mb-6">
                <button 
                    onClick={() => setMode('CREATE')} 
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${mode === 'CREATE' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                    Create Room
                </button>
                <button 
                    onClick={() => setMode('JOIN')} 
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${mode === 'JOIN' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                    Join Room
                </button>
            </div>

            <form onSubmit={handleAction} className="space-y-6">
                 {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-xl text-sm border border-red-500/50">{error}</div>}
                 
                 <div>
                     <label className="block text-sm font-bold text-gray-300 mb-2">USERNAME</label>
                     <input 
                         type="text" 
                         value={nameInput}
                         maxLength={12}
                         onChange={e => setNameInput(e.target.value.toUpperCase())}
                         className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white font-bold tracking-wider outline-none focus:border-uno-blue transition"
                         placeholder="ENTER NAME"
                     />
                 </div>

                 {mode === 'JOIN' && (
                     <div>
                         <label className="block text-sm font-bold text-gray-300 mb-2">ROOM CODE</label>
                         <input 
                             type="text" 
                             value={roomInput}
                             maxLength={6}
                             onChange={e => setRoomInput(e.target.value.toUpperCase())}
                             className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-uno-red transition text-center tracking-[0.5em]"
                             placeholder="XXXXXX"
                         />
                     </div>
                 )}

                 <button type="submit" className="w-full bg-gradient-to-r from-uno-red to-uno-yellow text-white font-black text-xl py-4 rounded-xl shadow-[0_0_20px_rgba(245,100,98,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all">
                     {mode === 'CREATE' ? 'CREATE SECURE LOBBY' : 'JOIN GAME'}
                 </button>
            </form>
        </div>
    );
}
