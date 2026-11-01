require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { askGroq } = require('./ai');
const {
  getRoom,
  joinRoom,
  leaveRoom,
  getUserName,
  getUserCount,
  addStrokeStart,
  addStrokePoints,
  addStrokeEnd,
  clearRoom,
  addAiMessage,
  getAiHistory,
  isAiInFlight,
  setAiInFlight,
  getLastAiTime,
  setLastAiTime,
  getUserSlot,
  roomExists,
  generateRoomId,
} = require('./rooms');

const PORT = process.env.PORT || 4000;

const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = { origin: ALLOWED_ORIGINS };

const app = express();
app.use(cors(corsOptions));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId, name, mode }) => {
    if (currentRoom) return; // already inside a room

    let id = typeof roomId === 'string' ? roomId.trim().toUpperCase() : '';

    if (mode === 'create') {
      id = generateRoomId();
    } else {
      if (!id || !roomExists(id)) {
        socket.emit('join-rejected', { reason: 'not-found' });
        return;
      }
      if (getUserCount(id) >= 2) {
        socket.emit('join-rejected', { reason: 'full' });
        return;
      }
    }

    currentRoom = id;
    joinRoom(id, socket.id, name);
    socket.join(id);

    const room = getRoom(id);
    socket.emit('room-state', {
      roomId: id,
      strokes: room.strokes,
      userCount: getUserCount(id),
    });

    io.to(id).emit('user-count', { count: getUserCount(id) });
  });

  // AI helper events
  socket.on('ai-ask', async ({ text }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room) return;

    if (typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;

    // Rate limit: one AI request in flight per room at a time
    if (isAiInFlight(currentRoom)) {
      socket.emit('ai-error', { message: 'An AI request is already in progress.' });
      return;
    }

    // Rate limit: minimum 3-second gap between requests per room
    const now = Date.now();
    const lastTime = getLastAiTime(currentRoom);
    if (now - lastTime < 3000) {
      socket.emit('ai-error', { message: 'Please wait a moment before asking another question.' });
      return;
    }

    setAiInFlight(currentRoom, true);
    setLastAiTime(currentRoom, now);

    const userName = getUserName(currentRoom, socket.id);
    const userMsgId = `${now}-${Math.random().toString(36).substring(2, 7)}-user`;

    addAiMessage(currentRoom, 'user', trimmed);
    io.to(currentRoom).emit('ai-message', {
      id: userMsgId,
      role: 'user',
      name: userName,
      userId: socket.id,
      slot: getUserSlot(currentRoom, socket.id),
      text: trimmed,
    });
    io.to(currentRoom).emit('ai-thinking', { thinking: true });

    try {
      const history = getAiHistory(currentRoom);
      const messages = [
          {
          role: 'system',
          content:
            'You are a concise tutor for computer science students. Answer clearly in under 200 words. ' +
            'Format with Markdown: short paragraphs, bullet lists, **bold** for key terms, and fenced code blocks with a language tag for code. ' +
            'Write math in LaTeX: inline as $...$ and display as $$...$$. Never use markdown tables.',
        },
        ...history,
      ];

      const answer = await askGroq(messages);
      const assistantMsgId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-assistant`;

      addAiMessage(currentRoom, 'assistant', answer);
      io.to(currentRoom).emit('ai-message', {
        id: assistantMsgId,
        role: 'assistant',
        text: answer,
      });
      io.to(currentRoom).emit('ai-thinking', { thinking: false });
    } catch (err) {
      console.error('AI error:', err.message);
      // Do not expose raw error details or API key to the client
      io.to(currentRoom).emit('ai-error', { message: 'AI is unavailable right now.' });
      io.to(currentRoom).emit('ai-thinking', { thinking: false });
    } finally {
      setAiInFlight(currentRoom, false);
      setLastAiTime(currentRoom, Date.now());
    }
  });

    // Newcomer finished setting up media → tell the existing user to send the offer
  socket.on('call-ready', () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('user-joined', { socketId: socket.id });
  });
  
  // WebRTC signaling relays — server only forwards, never stores
  socket.on('webrtc-offer', ({ sdp, to }) => {
    socket.to(to).emit('webrtc-offer', { sdp, from: socket.id });
  });

  socket.on('webrtc-answer', ({ sdp, to }) => {
    socket.to(to).emit('webrtc-answer', { sdp, from: socket.id });
  });

  socket.on('webrtc-ice-candidate', ({ candidate, to }) => {
    socket.to(to).emit('webrtc-ice-candidate', { candidate, from: socket.id });
  });

  socket.on('media-state', ({ micOn, cameraOn, to }) => {
    socket.to(to).emit('media-state', { micOn, cameraOn });
  });

  socket.on('stroke-start', ({ color, size }) => {
    if (!currentRoom) return;
    addStrokeStart(currentRoom, color, size);
    socket.to(currentRoom).emit('stroke-start', { color, size });
  });

  socket.on('stroke-points', ({ points }) => {
    if (!currentRoom) return;
    addStrokePoints(currentRoom, points);
    socket.to(currentRoom).emit('stroke-points', { points });
  });

  socket.on('stroke-end', () => {
    if (!currentRoom) return;
    addStrokeEnd(currentRoom);
    socket.to(currentRoom).emit('stroke-end');
  });

  socket.on('clear-board', () => {
    if (!currentRoom) return;
    clearRoom(currentRoom);
    io.to(currentRoom).emit('clear-board');
  });
    socket.on('leave-room', () => {
    if (!currentRoom) return;
    const roomId = currentRoom;
    socket.leave(roomId);
    leaveRoom(roomId, socket.id);
    currentRoom = null;
    io.to(roomId).emit('user-count', { count: getUserCount(roomId) });
  });
  
  socket.on('disconnect', () => {
    if (!currentRoom) return;
    leaveRoom(currentRoom, socket.id);
    io.to(currentRoom).emit('user-count', { count: getUserCount(currentRoom) });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
