import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketEvents } from './gameRoom.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"] : ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// Simple health check
app.get('/', (req, res) => {
  res.send('UNO SURVIVAL PRO Backend is running.');
});

// Pass IO instance to game room manager
setupSocketEvents(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
