# UNO-SURVIVAL-PRO

A Complete, Production-Ready Multiplayer UNO Web Application.

## Features
- **Survival Mode:** Only one player remains.
- **7-Player Lobbies:** Custom game invites with one-time tokens.
- **Twists System:** Unique chaotic cards (Color Chaos, Double Trouble, Blind Turn, Swap Storm, Time Bomb).
- **WebRTC Voice Chat:** Real-time peer-to-peer audio with spatial/host controls.
- **Anti-Cheat:** Server-side validation.
- **Advanced UX:** Framer Motion animations, themes, canvas confetti screen shake effects.
- **Entry Password:** `8238557163`

## Quick Start

Only one command is required to start both backend and frontend.

```bash
npm install && npm run dev
```

Ensure your `.env` file in `/server` matches the defaults for localhost.

## Deployment Steps
1. Push to your Git repository.
2. (Backend) Deploy the raw Node server from `/server` on Render/Railway. Ensure you set Environment variables (`PORT`, `CLIENT_URL` to your Vercel URL, `NODE_ENV=production`).
3. (Frontend) Deploy the React Vite app on Vercel from `/client`. Ensure you set its environment variable `VITE_SERVER_URL` to your Render/Railway backend URL.

## How to invite friends
In the Lobby screen, enter the password. The first user becomes the Host.
The host dashboard allows generating ONE-TIME invite links to be sent to friends.
