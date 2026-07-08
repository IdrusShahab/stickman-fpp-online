const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'stickman-dev-secret-ganti-di-production';
const JWT_EXPIRES = '7d';
const BCRYPT_ROUNDS = 10;

const usernameRe = /^[a-zA-Z0-9_]{3,20}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeDisplayName(name) {
  return String(name || '').trim().slice(0, 16);
}

function validateRegister({ username, email, password, displayName }) {
  const u = String(username || '').trim();
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  const d = sanitizeDisplayName(displayName);

  if (!usernameRe.test(u)) {
    return { error: 'Username 3-20 karakter, huruf/angka/underscore saja' };
  }
  if (!emailRe.test(e)) {
    return { error: 'Format email tidak valid' };
  }
  if (p.length < 6) {
    return { error: 'Password minimal 6 karakter' };
  }
  if (d.length < 2) {
    return { error: 'Nama tampilan minimal 2 karakter' };
  }
  return { username: u, email: e, password: p, displayName: d };
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
}

function registerUser(payload) {
  const valid = validateRegister(payload);
  if (valid.error) return { error: valid.error };

  const { username, email, password, displayName } = valid;
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (existingUser) return { error: 'Username sudah dipakai' };

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existingEmail) return { error: 'Email sudah terdaftar' };

  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const createdAt = Date.now();

  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, email, passwordHash, displayName, createdAt);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);
  return { user: publicUser(user), token };
}

function loginUser(usernameOrEmail, password) {
  const login = String(usernameOrEmail || '').trim();
  const pass = String(password || '');
  if (!login || !pass) return { error: 'Username/email dan password wajib diisi' };

  const user = db.prepare(`
    SELECT * FROM users
    WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
  `).get(login, login.toLowerCase());

  if (!user || !bcrypt.compareSync(pass, user.password_hash)) {
    return { error: 'Username/email atau password salah' };
  }

  const token = signToken(user);
  return { user: publicUser(user), token };
}

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      displayName: user.display_name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user) throw new Error('User tidak ditemukan');
  return publicUser(user);
}

module.exports = {
  registerUser,
  loginUser,
  verifyToken,
  JWT_SECRET
};