(function () {
  'use strict';

  const TOKEN_KEY = 'stickman-auth-token';
  const USER_KEY = 'stickman-auth-user';

  let currentUser = null;

  const authScreen = document.getElementById('auth-screen');
  const menuScreen = document.getElementById('menu-screen');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const authError = document.getElementById('auth-error');
  const welcomeNameEl = document.getElementById('user-display-name');
  const logoutBtn = document.getElementById('logout-btn');

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    currentUser = user;
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    currentUser = null;
  }

  function showError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
  }

  function clearError() {
    authError.textContent = '';
    authError.classList.add('hidden');
  }

  function showAuthScreen() {
    authScreen.classList.remove('hidden');
    menuScreen.classList.add('hidden');
  }

  function showMenuScreen() {
    if (!currentUser) return;
    authScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    if (welcomeNameEl) welcomeNameEl.textContent = currentUser.displayName;
    document.dispatchEvent(new CustomEvent('auth:login', { detail: currentUser }));
  }

  function logout() {
    clearSession();
    showAuthScreen();
    document.dispatchEvent(new CustomEvent('auth:logout'));
  }

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Terjadi kesalahan');
    }
    return data;
  }

  function switchTab(tab) {
    clearError();
    const isLogin = tab === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
  }

  async function restoreSession() {
    const token = getToken();
    const cached = localStorage.getItem(USER_KEY);
    if (!token) {
      showAuthScreen();
      return;
    }

    try {
      const data = await api('/api/auth/me');
      saveSession(token, data.user);
      showMenuScreen();
    } catch {
      clearSession();
      showAuthScreen();
    }
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      saveSession(data.token, data.user);
      showMenuScreen();
    } catch (err) {
      showError(err.message);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const displayName = document.getElementById('reg-displayname').value;
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    if (password !== passwordConfirm) {
      showError('Konfirmasi password tidak cocok');
      return;
    }

    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, displayName, password })
      });
      saveSession(data.token, data.user);
      showMenuScreen();
    } catch (err) {
      showError(err.message);
    }
  });

  logoutBtn.addEventListener('click', logout);

  window.GameAuth = {
    getToken,
    getUser: () => currentUser,
    isLoggedIn: () => !!currentUser && !!getToken(),
    logout
  };

  restoreSession();
})();