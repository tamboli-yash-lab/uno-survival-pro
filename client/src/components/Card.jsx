import React from 'react';
import { motion } from 'framer-motion';

const getColorClass = (color) => {
    switch (color) {
        case 'red': return 'bg-uno-red';
        case 'blue': return 'bg-uno-blue';
        case 'green': return 'bg-uno-green';
        case 'yellow': return 'bg-uno-yellow';
        case 'black': return 'bg-uno-black';
        case 'twist': return 'bg-gradient-to-br from-purple-500 via-pink-500 to-red-500';
        default: return 'bg-gray-800';
    }
};

const getDisplayValue = (card) => {
    if (card.type === 'wild') return 'W';
    if (card.value === 'wildDraw4') return '+4';
    if (card.value === 'draw2') return '+2';
    if (card.value === 'skip') return '⊘';
    if (card.value === 'reverse') return '⇄';
    if (card.type === 'twist') return '⚡';
    return card.value;
};

export default function Card({ card, onClick, isPlayable, className = "" }) {
    if (!card) return <div className={`w-24 h-36 rounded-xl border-4 border-white/20 bg-black/50 ${className}`} />;

    const isWild = card.type === 'wild' || card.type === 'twist';
    
    return (
        <motion.div
            layoutId={card.id}
            whileHover={isPlayable ? { y: -25, scale: 1.15, zIndex: 50, rotate: -2 } : {}}
            whileTap={isPlayable ? { scale: 0.95 } : {}}
            onClick={isPlayable ? onClick : undefined}
            className={`
                relative w-28 h-40 rounded-xl border-[5px] ${isPlayable ? 'border-white cursor-pointer shadow-[0_10px_20px_rgba(0,0,0,0.6)]' : 'border-white/20 opacity-40 grayscale-[40%]'} 
                ${getColorClass(card.color)} select-none shrink-0 overflow-hidden transition-all duration-300
                ${className}
            `}
        >
            {/* Top Left Value */}
            <div className="absolute top-1 left-2 text-white font-black text-xl leading-none drop-shadow-md">
                {getDisplayValue(card)}
            </div>
            
            {/* Center Ellipse Overlay */}
            <div className="absolute inset-0 m-auto w-[85%] h-[60%] border-4 border-white transform -skew-y-12 rounded-full flex items-center justify-center bg-white/20 shadow-inner">
                 <span className={`text-5xl font-black text-white drop-shadow-lg transform skew-y-12 ${isWild ? 'animate-pulse text-transparent bg-clip-text bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400' : ''}`}>
                    {getDisplayValue(card)}
                 </span>
            </div>
            
            {/* Bottom Right Value */}
            <div className="absolute bottom-1 right-2 text-white font-black text-xl leading-none rotate-180 drop-shadow-md">
                {getDisplayValue(card)}
            </div>
        </motion.div>
    );
}
