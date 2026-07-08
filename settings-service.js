const db = require('./db');

const DEFAULT_SETTINGS = {
  cameraMode: 'fpp',
  keybinds: {
    forward: 'KeyW',
    backward: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    run: 'ShiftLeft',
    jump: 'Space',
    chat: 'Enter',
    voiceNote: 'Insert',
    toggleCamera: 'KeyV',
    pause: 'KeyP'
  }
};

const ALLOWED_ACTIONS = Object.keys(DEFAULT_SETTINGS.keybinds);
const ALLOWED_CAMERA = new Set(['fpp', 'tpp']);
const MAX_KEY_CODE_LEN = 32;

function sanitizeSettings(input) {
  const parsed = input && typeof input === 'object' ? input : {};
  const cameraMode = ALLOWED_CAMERA.has(parsed.cameraMode) ? parsed.cameraMode : DEFAULT_SETTINGS.cameraMode;
  const keybinds = { ...DEFAULT_SETTINGS.keybinds };

  if (parsed.keybinds && typeof parsed.keybinds === 'object') {
    ALLOWED_ACTIONS.forEach((action) => {
      const code = parsed.keybinds[action];
      if (typeof code === 'string' && code.length > 0 && code.length <= MAX_KEY_CODE_LEN) {
        keybinds[action] = code;
      }
    });
  }

  if (keybinds.pause === 'Escape') keybinds.pause = 'KeyP';

  return { cameraMode, keybinds };
}

function getUserSettings(userId) {
  const row = db.prepare('SELECT settings_json FROM user_settings WHERE user_id = ?').get(userId);
  if (!row) return null;
  try {
    return sanitizeSettings(JSON.parse(row.settings_json));
  } catch {
    return null;
  }
}

function saveUserSettings(userId, settings) {
  const clean = sanitizeSettings(settings);
  const json = JSON.stringify(clean);
  const now = Date.now();
  const existing = db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').get(userId);

  if (existing) {
    db.prepare('UPDATE user_settings SET settings_json = ?, updated_at = ? WHERE user_id = ?')
      .run(json, now, userId);
  } else {
    db.prepare('INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)')
      .run(userId, json, now);
  }

  return clean;
}

module.exports = {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  getUserSettings,
  saveUserSettings
};