const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 5e6
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const players = new Map();

const ROOM = {
  width: 20,
  depth: 20,
  height: 6
};

function clampPosition(pos) {
  const margin = 0.5;
  const halfW = ROOM.width / 2 - margin;
  const halfD = ROOM.depth / 2 - margin;

  return {
    x: Math.max(-halfW, Math.min(halfW, pos.x)),
    y: Math.max(0, Math.min(ROOM.height - 1.8, pos.y)),
    z: Math.max(-halfD, Math.min(halfD, pos.z)),
    rotationY: pos.rotationY || 0
  };
}

function getPlayerList() {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    ping: p.ping,
    position: p.position,
    isRunning: p.isRunning,
    isJumping: p.isJumping
  }));
}

io.on('connection', (socket) => {
  const defaultName = `Player${Math.floor(Math.random() * 9000) + 1000}`;

  players.set(socket.id, {
    id: socket.id,
    nickname: defaultName,
    ping: 0,
    position: { x: 0, y: 0, z: 0, rotationY: 0 },
    isRunning: false,
    isJumping: false,
    lastPingTime: Date.now()
  });

  socket.emit('init', {
    id: socket.id,
    nickname: defaultName,
    room: ROOM,
    players: getPlayerList()
  });

  io.emit('playerJoined', {
    id: socket.id,
    nickname: defaultName,
    ping: 0,
    position: { x: 0, y: 0, z: 0, rotationY: 0 }
  });

  socket.on('setNickname', (nickname) => {
    const player = players.get(socket.id);
    if (!player) return;

    const clean = String(nickname || '').trim().slice(0, 16);
    if (!clean) return;

    player.nickname = clean;
    io.emit('playerUpdated', {
      id: socket.id,
      nickname: player.nickname
    });
  });

  socket.on('ping', (clientTime) => {
    const player = players.get(socket.id);
    if (player) {
      player.ping = Date.now() - clientTime;
      player.lastPingTime = Date.now();
    }
    socket.emit('pong', clientTime);
  });

  socket.on('playerMove', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    player.position = clampPosition({
      x: data.x,
      y: data.y,
      z: data.z,
      rotationY: data.rotationY
    });
    player.isRunning = !!data.isRunning;
    player.isJumping = !!data.isJumping;

    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      position: player.position,
      isRunning: player.isRunning,
      isJumping: player.isJumping
    });
  });

  socket.on('chatMessage', (message) => {
    const player = players.get(socket.id);
    if (!player) return;

    const clean = String(message || '').trim().slice(0, 200);
    if (!clean) return;

    io.emit('chatMessage', {
      id: socket.id,
      nickname: player.nickname,
      message: clean,
      timestamp: Date.now()
    });
  });

  socket.on('voiceNote', (data) => {
    const player = players.get(socket.id);
    if (!player || !data || !data.audio) return;

    const audio = String(data.audio);
    if (audio.length > 900000) return;

    const mimeType = String(data.mimeType || 'audio/webm').split(';')[0].slice(0, 24);

    socket.broadcast.emit('voiceNote', {
      id: socket.id,
      nickname: player.nickname,
      audio,
      mimeType
    });
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('playerLeft', { id: socket.id });
  });
});

setInterval(() => {
  const now = Date.now();
  for (const player of players.values()) {
    if (now - player.lastPingTime > 5000) {
      player.ping = 999;
    }
  }
  io.emit('playerList', getPlayerList());
}, 2000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Stickman FPP server running on port ${PORT}`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://<IP-PC-KAMU>:${PORT}`);
});