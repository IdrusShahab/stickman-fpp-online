const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerUser, loginUser, verifyToken } = require('./auth-service');
const { getUserSettings, saveUserSettings } = require('./settings-service');
const { ROOM, PARTITIONS, resolvePartitions } = require('./room-layout');

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

function getAuthUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sesi tidak valid' });
  }
  res.json({ user });
});

app.get('/api/settings', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sesi tidak valid' });
  }
  const settings = getUserSettings(user.id);
  res.json({ settings });
});

app.put('/api/settings', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sesi tidak valid' });
  }
  const saved = saveUserSettings(user.id, req.body?.settings || req.body);
  res.json({ settings: saved });
});

app.use(express.static(path.join(__dirname, 'public')));

const players = new Map();

function clampPosition(pos) {
  const margin = 0.5;
  const halfW = ROOM.width / 2 - margin;
  const halfD = ROOM.depth / 2 - margin;

  let x = Math.max(-halfW, Math.min(halfW, pos.x));
  let z = Math.max(-halfD, Math.min(halfD, pos.z));
  const resolved = resolvePartitions(x, z, PARTITIONS);
  x = resolved.x;
  z = resolved.z;

  return {
    x,
    y: Math.max(0, Math.min(ROOM.height - 1.8, pos.y)),
    z,
    rotationY: pos.rotationY || 0
  };
}

function clampPing(ms) {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.min(999, Math.round(ms)));
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
    socket.emit('pong', clientTime);
  });

  socket.on('pingUpdate', (ping) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.ping = clampPing(ping);
    player.lastPingTime = Date.now();
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