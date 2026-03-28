import { buildDeck, isValidPlay } from '../shared/gameLogic.js';

export class GameEngine {
    constructor(players, settings) {
        this.players = players.map(p => ({
            username: p.username,
            hand: [],
            isSafe: false, // Finished cards
            isActive: true, // Playing or eliminated
            isBot: p.isBot,
            offlineSince: null
        }));
        this.settings = settings;
        this.deck = buildDeck(settings.enableTwists, settings.chaosSlider);
        this.discardPile = [];
        this.turnIndex = 0;
        this.direction = 1; // 1 = clockwise, -1 = counter
        this.currentColor = null;
        this.unoCallers = new Set();
        this.turnStartTime = Date.now();
        this.rankings = []; // To store order of finishing
        this.messages = [];
        this.hasDrawnThisTurn = false;
    }

    start() {
        // Deal cards
        const dist = parseInt(this.settings.cardDistribution) || 7;
        for (let i = 0; i < dist; i++) {
            for (let p of this.players) {
                p.hand.push(this._draw());
            }
        }
        
        let initialTop = this._draw();
        while(initialTop.type === 'wild' || initialTop.type === 'twist' || initialTop.type === 'action') {
             this.deck.push(initialTop);
             this._shuffle(this.deck);
             initialTop = this._draw();
        }
        this.discardPile.push(initialTop);
        this.currentColor = initialTop.color;
    }

    _draw() {
        if (this.deck.length === 0) {
            // Reshuffle discard
            const top = this.discardPile.pop();
            this.deck = [...this.discardPile];
            this._shuffle(this.deck);
            this.discardPile = [top];
        }
        return this.deck.pop();
    }

    _shuffle(array) {
       for(let i = array.length - 1; i > 0; i--){
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
       }
    }

    getTopCard() {
        return this.discardPile[this.discardPile.length - 1];
    }
    
    getActivePlayersCount() {
       return this.players.filter(p => !p.isSafe && p.isActive).length;
    }

    getDetailedStateFor(username) {
        const topCard = this.getTopCard();
        return {
             players: this.players.map(p => ({
                  username: p.username,
                  cardCount: p.hand.length,
                  isSafe: p.isSafe,
                  isActive: p.isActive,
                  isCurrentTurn: this.players[this.turnIndex].username === p.username
             })),
             myHand: this.players.find(p => p.username === username)?.hand || [],
             topCard,
             currentColor: this.currentColor,
             direction: this.direction,
             deckCount: this.deck.length,
             hasDrawnThisTurn: this.hasDrawnThisTurn,
             turnTimeLeft: this.settings.turnTimer ? Math.max(0, this.settings.turnTimer - Math.floor((Date.now() - this.turnStartTime)/1000)) : null,
             messages: this.messages,
             rankings: this.rankings,
             isGameOver: this.getActivePlayersCount() <= 1
        };
    }

    _nextTurn() {
        if (this.getActivePlayersCount() <= 1) return; // Game over
        
        this.turnStartTime = Date.now();
        this.hasDrawnThisTurn = false;
        do {
           this.turnIndex = (this.turnIndex + this.direction + this.players.length) % this.players.length;
        } while (this.players[this.turnIndex].isSafe || !this.players[this.turnIndex].isActive);
    }

    playCard(username, cardId, selectedColor) {
        if (this.players[this.turnIndex].username !== username) return false;
        
        const player = this.players.find(p => p.username === username);
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return false;

        const card = player.hand[cardIndex];
        if (!isValidPlay(card, this.getTopCard(), this.currentColor)) return false;

        // Apply UNO penalty check
        if (player.hand.length === 2 && !this.unoCallers.has(username)) {
             // Forgot to call UNO before playing second to last card!
             player.hand.push(this._draw(), this._draw());
             this.messages.push({ text: `${username} forgot to press UNO and drew 2!`, type: 'alert' });
        }

        player.hand.splice(cardIndex, 1);
        this.discardPile.push(card);
        this.currentColor = card.color;
        this.unoCallers.delete(username); // Reset caller state

        this._applyCardEffect(card, selectedColor);
        
        this._checkSurvival(player);

        if(this.getActivePlayersCount() > 1 && card.value !== 'skip' && card.value !== 'skipEffect' && card.value !== 'reverse') {
            this._nextTurn();
        }

        return true;
    }

    _applyCardEffect(card, selectedColor) {
        if (card.type === 'wild') {
             this.currentColor = selectedColor || 'red';
             if (card.value === 'wildDraw4') {
                  this._nextTurn();
                  const target = this.players[this.turnIndex];
                  for(let i=0; i<4; i++) target.hand.push(this._draw());
                  this.messages.push({ text: `${target.username} draws 4!`, type: 'action' });
                  card.value = 'skipEffect';
             }
        } else if (card.type === 'action') {
             if (card.value === 'skip') {
                  this._nextTurn();
             } else if (card.value === 'reverse') {
                  if (this.getActivePlayersCount() === 2) {
                      this._nextTurn();
                  } else {
                      this.direction *= -1;
                  }
             } else if (card.value === 'draw2') {
                  this._nextTurn();
                  const target = this.players[this.turnIndex];
                  for(let i=0; i<2; i++) target.hand.push(this._draw());
                  this.messages.push({ text: `${target.username} draws 2!`, type: 'action' });
                  card.value = 'skipEffect';
             }
        }
    }


    _checkSurvival(player) {
         if (player.hand.length === 0 && !player.isSafe) {
             player.isSafe = true;
             this.rankings.push(player.username);
             this.messages.push({ text: `${player.username} is SAFE!`, type: 'safe' });
         }
         
         if (this.getActivePlayersCount() === 1) {
             const loser = this.players.find(p => !p.isSafe && p.isActive);
             if (loser) {
                 this.rankings.push(loser.username);
                 this.messages.push({ text: `${loser.username} is the LOSER!`, type: 'loser' });
             }
         }
    }

    drawCard(username) {
        if (this.players[this.turnIndex].username !== username) return;
        if (this.hasDrawnThisTurn) return;

        const player = this.players.find(p => p.username === username);
        const drawnCard = this._draw();
        player.hand.push(drawnCard);

        if (isValidPlay(drawnCard, this.getTopCard(), this.currentColor)) {
             this.hasDrawnThisTurn = true;
        } else {
             this._nextTurn();
        }
    }

    passTurn(username) {
         if (this.players[this.turnIndex].username !== username) return;
         if (!this.hasDrawnThisTurn) return;
         this._nextTurn();
         return true;
    }

    callUno(username) {
        this.unoCallers.add(username);
    }

    markOfflineTime(username) {
         const p = this.players.find(pl => pl.username === username);
         if(p) p.offlineSince = Date.now();
    }

    handlePlayerExit(username) {
         const player = this.players.find(p => p.username === username);
         if(player) {
              player.isActive = false;
              if (this.players[this.turnIndex].username === username) this._nextTurn();
         }
    }

    update(io) {
         if (this.getActivePlayersCount() <= 1) return; // Game over or paused
         
         const currentPlayer = this.players[this.turnIndex];
         
         // Bot takeover after 15s offline or if explicitly bot
         const isOfflineTooLong = (currentPlayer.offlineSince && (Date.now() - currentPlayer.offlineSince > 15000));
         
         const timeElapsed = (Date.now() - this.turnStartTime) / 1000;
         const turnTimedOut = this.settings.turnTimer && timeElapsed > this.settings.turnTimer;

         if (currentPlayer.isBot || isOfflineTooLong || turnTimedOut) {
              // Add a simulated short bot delay (500ms to 1500ms) only for bots, unless offline timeout triggered
              if (currentPlayer.isBot && !currentPlayer._typingDelay) {
                   currentPlayer._typingDelay = Date.now() + (Math.random() * 1000 + 500);
              }
              if (currentPlayer._typingDelay && Date.now() < currentPlayer._typingDelay && !turnTimedOut) {
                   return; // Wait for delay
              }
              currentPlayer._typingDelay = null; // Clear delay
              
              const validCards = currentPlayer.hand.filter(c => isValidPlay(c, this.getTopCard(), this.currentColor));
              let cardToPlay = null;

              if (validCards.length > 0) {
                   if (currentPlayer.archetype === 'AGGRESSIVE') {
                       cardToPlay = validCards.find(c => ['skip', 'reverse', 'draw2', 'wild', 'wildDraw4'].includes(c.value)) || validCards[0];
                   } else {
                       // SAFE: Prefer simple numbers
                       cardToPlay = validCards.find(c => c.type === 'number') || validCards[0];
                   }
                   
                   if(currentPlayer.hand.length === 2) this.callUno(currentPlayer.username);
                   const color = cardToPlay.type === 'wild' ? ['red', 'blue', 'green', 'yellow'][Math.floor(Math.random()*4)] : null;
                   this.playCard(currentPlayer.username, cardToPlay.id, color);
              } else {
                   this.drawCard(currentPlayer.username);
              }
              // Broadcast update
              io.to('UNO_ROOM').emit('game_update', this.getDetailedStateFor('SPECTATOR'));
         }
    }
}
