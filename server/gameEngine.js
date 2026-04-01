import { buildDeck, isValidPlay, sortHand } from '../shared/gameLogic.js';

export class GameEngine {
    constructor(players, settings) {
        this.players = players.map(p => ({
            username:    p.username,
            hand:        [],
            isSafe:      false,
            isActive:    true,
            isBot:       p.isBot,
            archetype:   p.archetype || 'SAFE',
            offlineSince: null,
        }));
        this.settings         = settings;
        this.deck             = buildDeck();
        this.discardPile      = [];
        this.turnIndex        = 0;
        this.direction        = 1;           // 1 = clockwise, -1 = counter
        this.currentColor     = null;
        this.unoCallers       = new Set();   // Players who pressed UNO
        this.unoPending       = new Map();   // username → timestamp (grace window)
        this.turnStartTime    = Date.now();
        this.rankings         = [];
        this.messages         = [];
        this.hasDrawnThisTurn = false;
        // Draw stacking
        this.drawStack        = 0;           // Accumulated draws pending
        this.drawStackType    = null;        // 'draw2' | 'wildDraw4'
    }

    // ── Start ─────────────────────────────────────────────────────────────────
    start() {
        const dist = parseInt(this.settings.cardDistribution) || 7;
        for (let i = 0; i < dist; i++) {
            for (const p of this.players) {
                p.hand.push(this._draw());
            }
        }

        // First card must be a number
        let initialTop = this._draw();
        while (initialTop.type !== 'number') {
            this.deck.unshift(initialTop);
            this._shuffle(this.deck);
            initialTop = this._draw();
        }
        this.discardPile.push(initialTop);
        this.currentColor = initialTop.color;

        // Apply first-card effect (action starts are allowed now by some rule sets)
        // We stay with number-only start for compatibility, but record ready
        this.turnStartTime = Date.now();
    }

    // ── Internal helpers ──────────────────────────────────────────────────────
    _draw() {
        if (this.deck.length === 0) {
            const top  = this.discardPile.pop();
            this.deck  = [...this.discardPile];
            this._shuffle(this.deck);
            this.discardPile = [top];
            this.messages.push({ text: 'Deck reshuffled!', type: 'alert' });
        }
        return this.deck.pop();
    }

    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    getTopCard()             { return this.discardPile[this.discardPile.length - 1]; }
    getActivePlayersCount()  { return this.players.filter(p => !p.isSafe && p.isActive).length; }
    getActivePlayers()       { return this.players.filter(p => !p.isSafe && p.isActive); }

    // ── State snapshot ────────────────────────────────────────────────────────
    getDetailedStateFor(username) {
        const topCard    = this.getTopCard();
        const me         = this.players.find(p => p.username === username);
        return {
            players: this.players.map(p => ({
                username:      p.username,
                cardCount:     p.hand.length,
                isSafe:        p.isSafe,
                isActive:      p.isActive,
                isBot:         p.isBot,
                isCurrentTurn: this.players[this.turnIndex]?.username === p.username,
                calledUno:     this.unoCallers.has(p.username),
                unoPending:    this.unoPending.has(p.username),
            })),
            myHand:           me?.hand || [],
            topCard,
            currentColor:     this.currentColor,
            direction:        this.direction,
            deckCount:        this.deck.length,
            hasDrawnThisTurn: this.hasDrawnThisTurn,
            drawStack:        this.drawStack,
            drawStackType:    this.drawStackType,
            turnTimeLeft:     this.settings.turnTimer
                ? Math.max(0, this.settings.turnTimer - Math.floor((Date.now() - this.turnStartTime) / 1000))
                : null,
            messages:  this.messages,
            rankings:  this.rankings,
            isGameOver: this.getActivePlayersCount() <= 1,
            roomSettings: this.settings,
        };
    }

    // ── Turn management ───────────────────────────────────────────────────────
    _nextTurn(skip = 1) {
        if (this.getActivePlayersCount() <= 1) return;
        this.turnStartTime    = Date.now();
        this.hasDrawnThisTurn = false;
        for (let s = 0; s < skip; s++) {
            do {
                this.turnIndex = (this.turnIndex + this.direction + this.players.length) % this.players.length;
            } while (this.players[this.turnIndex].isSafe || !this.players[this.turnIndex].isActive);
        }
    }

    _peekNextPlayer(skip = 1) {
        let idx = this.turnIndex;
        for (let s = 0; s < skip; s++) {
            do {
                idx = (idx + this.direction + this.players.length) % this.players.length;
            } while (this.players[idx].isSafe || !this.players[idx].isActive);
        }
        return this.players[idx];
    }

    // ── Play Card ─────────────────────────────────────────────────────────────
    playCard(username, cardId, selectedColor, fromJumpIn = false) {
        const currentPlayer = this.players[this.turnIndex];

        // Jump-in: allow ANY player if it's enabled and card matches exactly
        if (!fromJumpIn && currentPlayer.username !== username) return false;
        if (fromJumpIn && !this.settings.jumpInRule)            return false;

        const player    = this.players.find(p => p.username === username);
        if (!player) return false;

        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return false;

        const card      = player.hand[cardIndex];
        const topCard   = this.getTopCard();

        // ── Draw stack: if stack is active, player MUST stack or accept ──────
        if (this.drawStack > 0) {
            const canStack =
                (this.drawStackType === 'draw2'     && card.value === 'draw2')     ||
                (this.drawStackType === 'wildDraw4' && card.value === 'wildDraw4') ||
                (this.settings.stackDrawCards &&
                    ((this.drawStackType === 'draw2'     && card.value === 'draw2') ||
                     (this.drawStackType === 'wildDraw4' && card.value === 'wildDraw4')));
            if (!canStack) return false;  // Must accept stack first via draw_card
        }

        // ── Validate play ─────────────────────────────────────────────────────
        if (!fromJumpIn) {
            const valid = isValidPlay(card, topCard, this.currentColor, player.hand, this.settings);
            if (!valid) return false;
        } else {
            // Jump-in: card must match top card exactly (same color + same value)
            if (card.color !== topCard.color || card.value !== topCard.value) return false;
        }

        // ── UNO penalty: playing second-to-last without UNO call ──────────────
        if (player.hand.length === 2 && !this.unoCallers.has(username) && !this.unoPending.has(username)) {
            player.hand.push(this._draw(), this._draw());
            this.messages.push({ text: `${username} forgot UNO and drew 2!`, type: 'alert' });
        }

        // ── Remove from hand, put on discard ──────────────────────────────────
        player.hand.splice(cardIndex, 1);
        this.discardPile.push(card);
        this.unoCallers.delete(username);

        // ── Auto-UNO at 1 card: set grace window ─────────────────────────────
        if (player.hand.length === 1) {
            this.callUno(username); // auto-register
        }
        if (player.hand.length > 1) {
            this.unoPending.delete(username);
        }

        // ── Jump-in: set turn to jumped-in player ────────────────────────────
        if (fromJumpIn) {
            const jumpIdx = this.players.findIndex(p => p.username === username);
            if (jumpIdx !== -1) this.turnIndex = jumpIdx;
        }

        // ── Apply effect ──────────────────────────────────────────────────────
        this._applyCardEffect(card, selectedColor, player);

        // ── Check survival ────────────────────────────────────────────────────
        this._checkSurvival(player);

        // ── Advance turn (unless the card effect already did it) ──────────────
        const selfHandling = ['skip', 'skipEffect', 'reverse', 'draw2', 'wildDraw4'].includes(card.value);
        if (!selfHandling && this.getActivePlayersCount() > 1) {
            this._nextTurn();
        }

        return true;
    }

    // ── Apply special card effects ────────────────────────────────────────────
    _applyCardEffect(card, selectedColor, playedBy) {
        const activePCount = this.getActivePlayersCount();

        if (card.type === 'wild') {
            this.currentColor = selectedColor || 'red';

            if (card.value === 'wildDraw4') {
                if (this.settings.stackDrawCards) {
                    this.drawStack    += 4;
                    this.drawStackType = 'wildDraw4';
                    this._nextTurn();
                    this.messages.push({ text: `Draw stack: ${this.drawStack}!`, type: 'action' });
                } else {
                    this._nextTurn();
                    const target = this.players[this.turnIndex];
                    for (let i = 0; i < 4; i++) target.hand.push(this._draw());
                    this.messages.push({ text: `${target.username} draws 4!`, type: 'action' });
                    this._nextTurn(); // Skip the draw victim
                }
            }

        } else if (card.type === 'action') {
            if (card.value === 'skip') {
                this._nextTurn(); // skip next, advance again later in playCard
                this.messages.push({ text: `${this._peekNextPlayer(0).username} was skipped!`, type: 'action' });
                this._nextTurn(); // now actually move to the player after the skip

            } else if (card.value === 'reverse') {
                if (activePCount === 2) {
                    // Acts like skip in 2-player
                    this._nextTurn();
                    this.messages.push({ text: 'Reversed — acts as skip!', type: 'action' });
                    this._nextTurn();
                } else {
                    this.direction *= -1;
                    this._nextTurn();
                    this.messages.push({ text: 'Direction reversed!', type: 'action' });
                }

            } else if (card.value === 'draw2') {
                if (this.settings.stackDrawCards) {
                    this.drawStack    += 2;
                    this.drawStackType = 'draw2';
                    this._nextTurn();
                    this.messages.push({ text: `Draw stack: ${this.drawStack}!`, type: 'action' });
                } else {
                    this._nextTurn();
                    const target = this.players[this.turnIndex];
                    for (let i = 0; i < 2; i++) target.hand.push(this._draw());
                    this.messages.push({ text: `${target.username} draws 2!`, type: 'action' });
                    this._nextTurn(); // Skip the draw victim
                }
            }

        } else if (card.type === 'number') {
            this.currentColor = card.color;

            // ── 7-0 rules ──────────────────────────────────────────────────
            if (this.settings.sevenZeroRule) {
                if (card.value === '7') {
                    // Swap hands with a random opponent (bot/auto) or chosen player
                    const active = this.getActivePlayers().filter(p => p.username !== playedBy.username);
                    if (active.length > 0) {
                        const target = active[Math.floor(Math.random() * active.length)];
                        const tmp    = playedBy.hand;
                        playedBy.hand = target.hand;
                        target.hand   = tmp;
                        this.messages.push({ text: `${playedBy.username} swapped hands with ${target.username}!`, type: 'action' });
                    }
                } else if (card.value === '0') {
                    // Rotate all active hands in direction of play
                    const active = this.getActivePlayers();
                    if (active.length > 1) {
                        const hands = active.map(p => p.hand);
                        if (this.direction === 1) {
                            active.forEach((p, i) => { p.hand = hands[(i + 1) % hands.length]; });
                        } else {
                            active.forEach((p, i) => { p.hand = hands[(i - 1 + hands.length) % hands.length]; });
                        }
                        this.messages.push({ text: 'All hands rotated!', type: 'action' });
                    }
                }
            }

            this._nextTurn();
        }
    }

    // ── Draw Card ─────────────────────────────────────────────────────────────
    drawCard(username) {
        if (this.players[this.turnIndex].username !== username) return;
        if (this.hasDrawnThisTurn && this.drawStack === 0) return;

        const player = this.players.find(p => p.username === username);

        // Accept stacked draws
        if (this.drawStack > 0) {
            for (let i = 0; i < this.drawStack; i++) player.hand.push(this._draw());
            this.messages.push({ text: `${username} draws ${this.drawStack}!`, type: 'alert' });
            this.drawStack     = 0;
            this.drawStackType = null;
            this._nextTurn();
            return;
        }

        // Normal draw
        const drawnCard = this._draw();
        player.hand.push(drawnCard);

        const playable = isValidPlay(drawnCard, this.getTopCard(), this.currentColor, player.hand, this.settings);

        if (this.settings.forcePlay && playable) {
            // Auto-play immediately
            const selectedColor = drawnCard.type === 'wild'
                ? ['red','blue','green','yellow'][Math.floor(Math.random() * 4)]
                : null;
            this.playCard(username, drawnCard.id, selectedColor);
            this.messages.push({ text: `${username} auto-played drawn card!`, type: 'action' });
        } else if (playable) {
            this.hasDrawnThisTurn = true; // May optionally play
        } else {
            this._nextTurn(); // No playable card, pass
        }
    }

    passTurn(username) {
        if (this.players[this.turnIndex].username !== username) return false;
        if (!this.hasDrawnThisTurn) return false;
        this._nextTurn();
        return true;
    }

    // ── Jump-In ───────────────────────────────────────────────────────────────
    jumpIn(username, cardId) {
        if (!this.settings.jumpInRule) return false;
        return this.playCard(username, cardId, null, true);
    }

    // ── UNO System ────────────────────────────────────────────────────────────
    callUno(username) {
        this.unoCallers.add(username);
        this.unoPending.delete(username);
    }

    catchUno(catcher, targetUsername) {
        const target = this.players.find(p => p.username === targetUsername);
        if (!target) return false;
        if (target.hand.length !== 1) return false;
        if (this.unoCallers.has(targetUsername)) return false; // already called

        // Penalty
        target.hand.push(this._draw(), this._draw());
        this.messages.push({ text: `${targetUsername} was caught! +2 penalty!`, type: 'alert' });
        this.unoCallers.delete(targetUsername);
        return true;
    }

    // ── Survival check ────────────────────────────────────────────────────────
    _checkSurvival(player) {
        if (player.hand.length === 0 && !player.isSafe) {
            player.isSafe = true;
            this.rankings.push(player.username);
            this.messages.push({ text: `${player.username} is SAFE! 🎉`, type: 'safe' });
        }
        if (this.getActivePlayersCount() === 1) {
            const loser = this.players.find(p => !p.isSafe && p.isActive);
            if (loser) {
                this.rankings.push(loser.username);
                this.messages.push({ text: `${loser.username} is the LOSER! 💀`, type: 'loser' });
            }
        }
    }

    // ── Player exit / offline ─────────────────────────────────────────────────
    markOfflineTime(username) {
        const p = this.players.find(pl => pl.username === username);
        if (p) p.offlineSince = Date.now();
    }

    handlePlayerExit(username) {
        const player = this.players.find(p => p.username === username);
        if (player) {
            player.isActive = false;
            if (this.players[this.turnIndex].username === username) this._nextTurn();
        }
    }

    // ── Bot / timeout update (called every second) ────────────────────────────
    update(io, roomId) {
        if (this.getActivePlayersCount() <= 1) return;

        const cp = this.players[this.turnIndex];
        const isOfflineTooLong = cp.offlineSince && (Date.now() - cp.offlineSince > 15000);
        const timeElapsed      = (Date.now() - this.turnStartTime) / 1000;
        const turnTimedOut     = this.settings.turnTimer && timeElapsed > this.settings.turnTimer;

        if (!cp.isBot && !isOfflineTooLong && !turnTimedOut) return;

        // Bot thinking delay
        if (cp.isBot && !cp._thinkDelay) {
            cp._thinkDelay = Date.now() + Math.random() * 1000 + 600;
        }
        if (cp._thinkDelay && Date.now() < cp._thinkDelay && !turnTimedOut) return;
        cp._thinkDelay = null;

        // ── If draw stack pending, bot must accept ────────────────────────────
        if (this.drawStack > 0) {
            const canStack = cp.hand.some(c =>
                (this.drawStackType === 'draw2'     && c.value === 'draw2') ||
                (this.drawStackType === 'wildDraw4' && c.value === 'wildDraw4')
            );
            if (!canStack) {
                this.drawCard(cp.username);
                this._broadcast(io, roomId);
                return;
            }
        }

        // ── Bot plays best card ───────────────────────────────────────────────
        const validCards = cp.hand.filter(c =>
            isValidPlay(c, this.getTopCard(), this.currentColor, cp.hand, this.settings)
        );

        if (validCards.length > 0) {
            let pick;
            if (cp.archetype === 'AGGRESSIVE') {
                pick = validCards.find(c => ['skip','reverse','draw2','wildDraw4','wild'].includes(c.value)) || validCards[0];
            } else {
                // Prefer numbers, save specials
                pick = validCards.find(c => c.type === 'number') || validCards[0];
            }

            if (cp.hand.length === 2) this.callUno(cp.username);
            const color = pick.type === 'wild'
                ? this._botChooseBestColor(cp.hand, pick)
                : null;
            this.playCard(cp.username, pick.id, color);
        } else {
            this.drawCard(cp.username);
        }

        this._broadcast(io, roomId);
    }

    _botChooseBestColor(hand, wildCard) {
        // Pick color player has most of
        const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
        for (const c of hand) {
            if (c.id !== wildCard.id && counts[c.color] !== undefined) counts[c.color]++;
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }

    _broadcast(io, roomId) {
        if (!io || !roomId) return;
        // Broadcast to room — each human gets their own hand view
        // This is called from gameRoom which also sends personalised updates
        io.to(roomId).emit('game_update_bot', true);
    }
}
