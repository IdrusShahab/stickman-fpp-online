const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerUser, loginUser, verifyToken } = require('./auth-service');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 5e6
});

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.post('/api/auth/register', (req, res) => {
  const result = registerUser(req.body || {});
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = loginUser(username, password);
  if (result.error) {
    return res.status(401).json({ error: result.error });
  }
  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  try {
    const user = verifyToken(token);
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Sesi tidak valid' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const players = new Map();

const ROOM = {
  width: 28,
  depth: 28,
  height: 3.4
};

const PARTITIONS = [
  { x: -8.5, z: -5, w: 11, d: 0.2 },
  { x: 8.5, z: -5, w: 11, d: 0.2 },
  { x: -8.5, z: 5, w: 11, d: 0.2 },
  { x: 8.5, z: 5, w: 11, d: 0.2 },
  { x: -5, z: -10, w: 0.2, d: 8 },
  { x: 5, z: -10, w: 0.2, d: 8 },
  { x: -5, z: 10, w: 0.2, d: 8 },
  { x: 5, z: 10, w: 0.2, d: 8 },
  { x: 0, z: -8, w: 6, d: 0.2 },
  { x: 0, z: 8, w: 6, d: 0.2 },
  { x: -8, z: 0, w: 0.2, d: 6 },
  { x: 8, z: 0, w: 0.2, d: 6 },
  { x: -11, z: -11, w: 6, d: 0.2 },
  { x: 11, z: 11, w: 6, d: 0.2 },
  { x: -11, z: 8, w: 0.2, d: 5 },
  { x: 11, z: -8, w: 0.2, d: 5 }
];

const PLAYER_RADIUS = 0.35;

function resolvePartitions(x, z) {
  for (const wall of PARTITIONS) {
    const halfW = wall.w / 2;
    const halfD = wall.d / 2;
    const dx = x - wall.x;
    const dz = z - wall.z;
    const closestX = Math.max(-halfW, Math.min(halfW, dx));
    const closestZ = Math.max(-halfD, Math.min(halfD, dz));
    const distX = dx - closestX;
    const distZ = dz - closestZ;
    const distSq = distX * distX + distZ * distZ;
    if (distSq < PLAYER_RADIUS * PLAYER_RADIUS && distSq > 0.000001) {
      const dist = Math.sqrt(distSq);
      const push = PLAYER_RADIUS - dist;
      x += (distX / dist) * push;
      z += (distZ / dist) * push;
    }
  }
  return { x, z };
}

function clampPosition(pos) {
  const margin = 0.5;
  const halfW = ROOM.width / 2 - margin;
  const halfD = ROOM.depth / 2 - margin;

  let x = Math.max(-halfW, Math.min(halfW, pos.x));
  let z = Math.max(-halfD, Math.min(halfD, pos.z));
  const resolved = resolvePartitions(x, z);
  x = resolved.x;
  z = resolved.z;

  return {
    x,
    y: Math.max(0, Math.min(ROOM.height - 1.8, pos.y)),
    z,
    rotationY: pos.rotationY || 0
  };
}

function getPlayerList() {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    username: p.username,
    ping: p.ping,
    position: p.position,
    isRunning: p.isRunning,
    isJumping: p.isJumping
  }));
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Login diperlukan'));
  }
  try {
    socket.account = verifyToken(token);
    next();
  } catch {
    next(new Error('Sesi tidak valid, silakan login ulang'));
  }
});

io.on('connection', (socket) => {
  const account = socket.account;
  const displayName = account.displayName;

  players.set(socket.id, {
    id: socket.id,
    userId: account.id,
    username: account.username,
    nickname: displayName,
    ping: 0,
    position: { x: 0, y: 0, z: 0, rotationY: 0 },
    isRunning: false,
    isJumping: false,
    lastPingTime: Date.now()
  });

  socket.emit('init', {
    id: socket.id,
    nickname: displayName,
    username: account.username,
    room: ROOM,
    partitions: PARTITIONS,
    players: getPlayerList()
  });

  io.emit('playerJoined', {
    id: socket.id,
    nickname: displayName,
    ping: 0,
    position: { x: 0, y: 0, z: 0, rotationY: 0 }
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
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET tidak diset. Gunakan env JWT_SECRET di production.');
  }
});