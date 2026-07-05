(function () {
  'use strict';

  const STORAGE_KEY = 'stickman-game-settings';

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

  const ACTION_LABELS = {
    forward: 'Maju',
    backward: 'Mundur',
    left: 'Kiri',
    right: 'Kanan',
    run: 'Lari',
    jump: 'Lompat',
    chat: 'Chat',
    voiceNote: 'Voice Note',
    toggleCamera: 'Ganti Kamera',
    pause: 'Pause'
  };

  const socket = io();
  let myId = null;
  let myNickname = 'Player';
  let roomData = { width: 20, depth: 20, height: 6 };

  const otherPlayers = new Map();
  const remoteTargets = new Map();

  let scene, camera, renderer;
  let localPlayerMesh = null;
  let isPlaying = false;
  let isPaused = false;
  let pointerLocked = false;
  let isOrbitMode = false;
  let settingsReturnTo = 'menu';

  const keys = {};
  let velocityY = 0;
  let isGrounded = true;
  let isRunning = false;
  let isJumping = false;
  let localWalkPhase = 0;

  const GRAVITY = -22;
  const WALK_SPEED = 5;
  const RUN_SPEED = 9;
  const BACK_SPEED = 3.5;
  const JUMP_FORCE = 8;
  const EYE_HEIGHT = 1.6;
  const TPP_DISTANCE = 4.5;
  const TPP_HEIGHT = 2.2;
  const ORBIT_DISTANCE = 5;
  const ORBIT_PIVOT_HEIGHT = 1.4;
  const ORBIT_MIN_PITCH = 0.15;
  const ORBIT_MAX_PITCH = 1.35;

  const position = { x: 0, y: 0, z: 0 };
  let yaw = 0;
  let pitch = 0;
  let orbitYaw = 0;
  let orbitPitch = 0.4;

  let settings = loadSettings();
  let rebindingAction = null;

  const menuScreen = document.getElementById('menu-screen');
  const gameUI = document.getElementById('game-ui');
  const pauseMenu = document.getElementById('pause-menu');
  const settingsPanel = document.getElementById('settings-panel');
  const playBtn = document.getElementById('play-btn');
  const mainSettingsBtn = document.getElementById('main-settings-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const pauseSettingsBtn = document.getElementById('pause-settings-btn');
  const quitBtn = document.getElementById('quit-btn');
  const settingsBackBtn = document.getElementById('settings-back-btn');
  const settingsResetBtn = document.getElementById('settings-reset-btn');
  const keybindListEl = document.getElementById('keybind-list');
  const nicknameInput = document.getElementById('nickname-input');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const playerListEl = document.getElementById('player-list');
  const myNicknameEl = document.getElementById('my-nickname');
  const myPingEl = document.getElementById('my-ping');
  const statusBar = document.getElementById('status-bar');
  const crosshair = document.getElementById('crosshair');
  const cameraModeBadge = document.getElementById('camera-mode-badge');
  const mobileControls = document.getElementById('mobile-controls');
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  const lookZone = document.getElementById('look-zone');
  const mobBtnRun = document.getElementById('mob-btn-run');
  const mobBtnJump = document.getElementById('mob-btn-jump');
  const mobBtnChat = document.getElementById('mob-btn-chat');
  const mobBtnCamera = document.getElementById('mob-btn-camera');
  const mobBtnPause = document.getElementById('mob-btn-pause');
  const mobBtnVoice = document.getElementById('mob-btn-voice');
  const voiceRecordingIndicator = document.getElementById('voice-recording-indicator');

  let useMobileControls = false;
  let mobileStick = { x: 0, y: 0 };
  let mobileRun = false;
  let mobileJumpQueued = false;
  let joystickPointerId = null;
  let lookPointerId = null;
  let joystickCenter = { x: 0, y: 0 };
  const JOYSTICK_MAX_RADIUS = 42;

  let lastMoveSent = 0;
  let pingInterval = null;

  let voiceRecording = false;
  let voiceMediaRecorder = null;
  let voiceStream = null;
  let voiceChunks = [];
  let voiceRecordTimeout = null;
  const VOICE_MAX_MS = 15000;
  const VOICE_MAX_BYTES = 500000;

  function isMobileDevice() {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const narrow = window.innerWidth <= 1024;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return touch && (narrow || mobileUa);
  }

  function canControlMovement() {
    return !isOrbitMode && (pointerLocked || useMobileControls);
  }

  function setMobileControlsVisible(visible) {
    if (!mobileControls) return;
    mobileControls.classList.toggle('hidden', !visible);
    mobileControls.classList.toggle('active', visible);
    document.body.classList.toggle('mobile-mode', visible);
  }

  function resetJoystick() {
    mobileStick.x = 0;
    mobileStick.y = 0;
    joystickPointerId = null;
    if (joystickZone) joystickZone.classList.remove('active');
    if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  }

  function updateJoystick(clientX, clientY) {
    let dx = clientX - joystickCenter.x;
    let dy = clientY - joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > JOYSTICK_MAX_RADIUS) {
      dx = (dx / dist) * JOYSTICK_MAX_RADIUS;
      dy = (dy / dist) * JOYSTICK_MAX_RADIUS;
    }
    if (joystickKnob) joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    mobileStick.x = dx / JOYSTICK_MAX_RADIUS;
    mobileStick.y = dy / JOYSTICK_MAX_RADIUS;
  }

  function applyLookDelta(dx, dy) {
    yaw -= dx * 0.004;
    pitch -= dy * 0.004;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    updateCamera();
  }

  function bindMobileButton(btn, onDown, onUp) {
    if (!btn) return;
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('pressed');
      onDown();
    };
    const up = (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove('pressed');
      if (onUp) onUp();
    };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up, { passive: false });
    btn.addEventListener('touchcancel', up, { passive: false });
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
  }

  function initMobileControls() {
    useMobileControls = isMobileDevice();
    if (!useMobileControls || !joystickZone) return;

    joystickZone.addEventListener('touchstart', (e) => {
      if (!isPlaying || isPaused) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      joystickPointerId = touch.identifier;
      const rect = joystickZone.getBoundingClientRect();
      joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      joystickZone.classList.add('active');
      updateJoystick(touch.clientX, touch.clientY);
    }, { passive: false });

    joystickZone.addEventListener('touchmove', (e) => {
      if (joystickPointerId === null) return;
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === joystickPointerId) {
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    const endJoystick = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === joystickPointerId) {
          resetJoystick();
          break;
        }
      }
    };
    joystickZone.addEventListener('touchend', endJoystick, { passive: false });
    joystickZone.addEventListener('touchcancel', endJoystick, { passive: false });

    lookZone.addEventListener('touchstart', (e) => {
      if (!isPlaying || isPaused || document.activeElement === chatInput) return;
      if (e.target.closest('#mobile-buttons, #joystick-zone, #chat-container')) return;
      const touch = e.changedTouches[0];
      lookPointerId = touch.identifier;
      lookZone.lastX = touch.clientX;
      lookZone.lastY = touch.clientY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
      if (lookPointerId === null) return;
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookPointerId) {
          const dx = touch.clientX - lookZone.lastX;
          const dy = touch.clientY - lookZone.lastY;
          lookZone.lastX = touch.clientX;
          lookZone.lastY = touch.clientY;
          applyLookDelta(dx, dy);
          break;
        }
      }
    }, { passive: false });

    const endLook = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === lookPointerId) lookPointerId = null;
      }
    };
    lookZone.addEventListener('touchend', endLook, { passive: false });
    lookZone.addEventListener('touchcancel', endLook, { passive: false });

    bindMobileButton(mobBtnRun, () => { mobileRun = true; }, () => { mobileRun = false; });
    bindMobileButton(mobBtnJump, () => { mobileJumpQueued = true; });
    bindMobileButton(mobBtnChat, () => openChat());
    bindMobileButton(mobBtnVoice, () => startVoiceNote(), () => stopVoiceNote());
    bindMobileButton(mobBtnCamera, () => toggleCameraMode());
    bindMobileButton(mobBtnPause, () => openPauseMenu());
  }

  function showVoiceRecordingUI(visible) {
    if (!voiceRecordingIndicator) return;
    voiceRecordingIndicator.classList.toggle('hidden', !visible);
  }

  function showVoiceToast(msg) {
    if (!statusBar) return;
    const prev = statusBar.textContent;
    statusBar.textContent = msg;
    statusBar.style.color = '#ce93d8';
    setTimeout(() => {
      statusBar.style.color = '';
      updateStatusBar();
    }, 2500);
  }

  function getVoiceMimeType() {
    if (typeof MediaRecorder === 'undefined') return null;
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return '';
  }

  async function startVoiceNote() {
    if (voiceRecording || !isPlaying || isPaused) return;
    if (document.activeElement === chatInput) return;

    const mimeType = getVoiceMimeType();
    if (!mimeType) {
      showVoiceToast('Browser tidak mendukung rekaman suara');
      return;
    }

    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceMediaRecorder = new MediaRecorder(voiceStream, { mimeType });
      voiceChunks = [];
      voiceMediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) voiceChunks.push(e.data);
      };
      voiceMediaRecorder.onstop = handleVoiceRecorded;
      voiceMediaRecorder.start(250);
      voiceRecording = true;
      showVoiceRecordingUI(true);
      voiceRecordTimeout = setTimeout(stopVoiceNote, VOICE_MAX_MS);
    } catch (_) {
      showVoiceToast('Izinkan akses mikrofon di browser');
    }
  }

  function stopVoiceNote() {
    if (!voiceRecording) return;
    clearTimeout(voiceRecordTimeout);
    voiceRecordTimeout = null;
    voiceRecording = false;
    showVoiceRecordingUI(false);
    if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
      voiceMediaRecorder.stop();
    } else {
      cleanupVoiceStream();
    }
  }

  function cleanupVoiceStream() {
    if (voiceStream) {
      voiceStream.getTracks().forEach((t) => t.stop());
      voiceStream = null;
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') resolve(result.split(',')[1]);
        else reject(new Error('read failed'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function handleVoiceRecorded() {
    const mimeType = voiceMediaRecorder ? voiceMediaRecorder.mimeType : 'audio/webm';
    cleanupVoiceStream();
    voiceMediaRecorder = null;

    if (!voiceChunks.length) return;

    const blob = new Blob(voiceChunks, { type: mimeType });
    voiceChunks = [];

    if (blob.size < 1000) return;
    if (blob.size > VOICE_MAX_BYTES) {
      showVoiceToast('Voice note terlalu panjang (max ~15 detik)');
      return;
    }

    try {
      const base64 = await blobToBase64(blob);
      socket.emit('voiceNote', { audio: base64, mimeType });
      if (localPlayerMesh) showVoiceBubble(localPlayerMesh);
    } catch (_) {
      showVoiceToast('Gagal mengirim voice note');
    }
  }

  function showVoiceBubble(mesh) {
    if (!mesh || !mesh.userData.chatBubbleSprite) return;
    showChatBubble(mesh, '🎤 Voice note');
  }

  function playVoiceNote(data) {
    if (!data || !data.audio) return;

    const mesh = data.id === myId ? localPlayerMesh : otherPlayers.get(data.id)?.mesh;
    if (mesh) showVoiceBubble(mesh);

    const audio = new Audio(`data:${data.mimeType || 'audio/webm'};base64,${data.audio}`);
    audio.play().catch(() => {});
  }

  function updateMobileCameraBtn() {
    if (!mobBtnCamera) return;
    mobBtnCamera.textContent = settings.cameraMode === 'tpp' ? 'TPP' : 'FPP';
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const keybinds = { ...DEFAULT_SETTINGS.keybinds, ...parsed.keybinds };
        if (keybinds.pause === 'Escape') keybinds.pause = 'KeyP';

        return {
          cameraMode: parsed.cameraMode || DEFAULT_SETTINGS.cameraMode,
          keybinds
        };
      }
    } catch (_) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function codeToLabel(code) {
    const map = {
      Space: 'Space', Enter: 'Enter', Escape: 'Esc', Insert: 'Insert',
      ShiftLeft: 'Shift', ShiftRight: 'Shift R',
      ControlLeft: 'Ctrl', ControlRight: 'Ctrl R',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'
    };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  function isActionPressed(action) {
    if (useMobileControls) {
      if (action === 'run') return mobileRun;
      if (action === 'jump') return mobileJumpQueued;
    }
    const code = settings.keybinds[action];
    if (!code) return false;
    if (keys[code]) return true;
    if (action === 'run' && (keys['ShiftLeft'] || keys['ShiftRight'])) {
      return settings.keybinds.run === 'ShiftLeft' || settings.keybinds.run === 'ShiftRight';
    }
    return false;
  }

  function hasJoystickInput() {
    return Math.abs(mobileStick.x) > 0.12 || Math.abs(mobileStick.y) > 0.12;
  }

  function buildSettingsUI() {
    keybindListEl.innerHTML = '';
    Object.keys(ACTION_LABELS).forEach((action) => {
      const row = document.createElement('div');
      row.className = 'keybind-row';
      row.innerHTML = `
        <span>${ACTION_LABELS[action]}</span>
        <button class="keybind-btn" data-action="${action}">${codeToLabel(settings.keybinds[action])}</button>
      `;
      keybindListEl.appendChild(row);
    });

    keybindListEl.querySelectorAll('.keybind-btn').forEach((btn) => {
      btn.addEventListener('click', () => startRebinding(btn.dataset.action));
    });

    document.querySelectorAll('.camera-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === settings.cameraMode);
      btn.onclick = () => {
        settings.cameraMode = btn.dataset.mode;
        document.querySelectorAll('.camera-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.mode === settings.cameraMode);
        });
        applyCameraMode();
        saveSettings();
      };
    });
  }

  function startRebinding(action) {
    rebindingAction = action;
    keybindListEl.querySelectorAll('.keybind-btn').forEach((btn) => {
      btn.classList.toggle('listening', btn.dataset.action === action);
      if (btn.dataset.action === action) btn.textContent = '...';
    });
  }

  function finishRebinding(code) {
    if (!rebindingAction) return;
    const reserved = ['pause'];
    if (rebindingAction !== 'pause' && code === settings.keybinds.pause) return;
    if (rebindingAction === 'pause' && code === settings.keybinds.chat) return;

    Object.keys(settings.keybinds).forEach((key) => {
      if (key !== rebindingAction && settings.keybinds[key] === code) {
        settings.keybinds[key] = '';
      }
    });

    settings.keybinds[rebindingAction] = code;
    rebindingAction = null;
    saveSettings();
    buildSettingsUI();
  }

  function openSettings(from) {
    settingsReturnTo = from;
    buildSettingsUI();
    if (from === 'pause') pauseMenu.classList.add('hidden');
    if (from === 'menu') menuScreen.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
  }

  function closeSettings() {
    settingsPanel.classList.add('hidden');
    rebindingAction = null;
    if (settingsReturnTo === 'pause') {
      pauseMenu.classList.remove('hidden');
    } else if (settingsReturnTo === 'menu') {
      menuScreen.classList.remove('hidden');
    } else if (settingsReturnTo === 'game' && isPlaying) {
      resumeGame();
    }
  }

  function openPauseMenu() {
    if (!isPlaying || isPaused) return;
    exitOrbitMode();
    clearMovementKeys();
    resetJoystick();
    mobileRun = false;
    stopVoiceNote();
    setMobileControlsVisible(false);
    isPaused = true;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    pauseMenu.classList.remove('hidden');
    gameUI.style.pointerEvents = 'auto';
    updateStatusBar();
  }

  function resumeGame() {
    isPaused = false;
    pauseMenu.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    gameUI.style.pointerEvents = useMobileControls ? 'auto' : 'none';
    if (!useMobileControls && (!document.activeElement || document.activeElement === document.body)) {
      renderer.domElement.requestPointerLock();
    }
    if (useMobileControls) setMobileControlsVisible(true);
    updateStatusBar();
  }

  function quitToMenu() {
    exitOrbitMode();
    resetJoystick();
    mobileRun = false;
    mobileJumpQueued = false;
    stopVoiceNote();
    setMobileControlsVisible(false);
    isPlaying = false;
    isPaused = false;
    pauseMenu.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    gameUI.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    document.exitPointerLock();

    if (localPlayerMesh) {
      clearChatBubble(localPlayerMesh);
      scene.remove(localPlayerMesh);
      localPlayerMesh = null;
    }
  }

  function applyCameraMode() {
    const isTpp = settings.cameraMode === 'tpp';
    const showBody = isTpp || isOrbitMode;

    if (isOrbitMode) {
      cameraModeBadge.textContent = 'ORBIT';
    } else {
      cameraModeBadge.textContent = isTpp ? 'TPP' : 'FPP';
    }

    crosshair.style.opacity = (isOrbitMode || isTpp) ? '0' : '1';

    if (localPlayerMesh) {
      localPlayerMesh.visible = showBody;
      if (localPlayerMesh.userData.nameSprite) {
        localPlayerMesh.userData.nameSprite.visible = false;
      }
    }
    updateMobileCameraBtn();
  }

  function enterOrbitMode() {
    isOrbitMode = true;
    orbitYaw = yaw;
    orbitPitch = settings.cameraMode === 'fpp'
      ? Math.max(ORBIT_MIN_PITCH, pitch + 0.25)
      : 0.4;
    document.exitPointerLock();
    clearMovementKeys();
    applyCameraMode();
    updateCamera();
    updateStatusBar();
  }

  function exitOrbitMode() {
    if (!isOrbitMode) return;
    isOrbitMode = false;
    clearMovementKeys();
    applyCameraMode();
    updateCamera();
    updateStatusBar();
  }

  function clearMovementKeys() {
    Object.keys(keys).forEach((k) => { keys[k] = false; });
  }

  function toggleCameraMode() {
    settings.cameraMode = settings.cameraMode === 'fpp' ? 'tpp' : 'fpp';
    document.querySelectorAll('.camera-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === settings.cameraMode);
    });
    applyCameraMode();
    saveSettings();
  }

  function updateStatusBar() {
    if (isPaused) {
      statusBar.textContent = 'Game dijeda — klik Lanjutkan';
      return;
    }
    if (isOrbitMode) {
      statusBar.textContent = 'Mode kamera — drag untuk putar karakter | lepas klik kanan untuk lanjut';
      return;
    }
    if (useMobileControls) {
      statusBar.textContent = 'Joystick: gerak | Area kanan: kamera | Tombol: lari/lompat/chat';
      return;
    }
    if (!pointerLocked) {
      statusBar.textContent = 'Klik kiri: gerak | Klik kanan tahan: putar kamera';
      return;
    }
    const parts = [
      `${codeToLabel(settings.keybinds.forward)}: maju`,
      `${codeToLabel(settings.keybinds.backward)}: mundur`,
      `${codeToLabel(settings.keybinds.run)}: lari`,
      `${codeToLabel(settings.keybinds.jump)}: lompat`
    ];
    parts.push(`${codeToLabel(settings.keybinds.voiceNote)}: voice`);
    parts.push(`${codeToLabel(settings.keybinds.toggleCamera)}: FPP/TPP`);
    parts.push(`${codeToLabel(settings.keybinds.pause)}: pause`);
    statusBar.textContent = parts.join(' | ');
  }

  function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1f2e);
    scene.fog = new THREE.Fog(0x1a1f2e, 15, 35);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xfff5e6, 0.85);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 40;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    scene.add(mainLight);

    const fillLight = new THREE.PointLight(0x4fc3f7, 0.3, 30);
    fillLight.position.set(0, 4, 0);
    scene.add(fillLight);

    window.addEventListener('resize', onResize);
  }

  function createRoom(w, d, h) {
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3d4f5f, roughness: 0.8 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5c6b7a, roughness: 0.7 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.6 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = h;
    scene.add(ceiling);

    const hw = w / 2;
    const hd = d / 2;

    const walls = [
      { size: [w, h], pos: [0, h / 2, -hd] },
      { size: [w, h], pos: [0, h / 2, hd] },
      { size: [d, h], pos: [-hw, h / 2, 0], rotY: Math.PI / 2 },
      { size: [d, h], pos: [hw, h / 2, 0], rotY: Math.PI / 2 }
    ];

    walls.forEach((wcfg) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(wcfg.size[0], wcfg.size[1]), wallMat);
      wall.position.set(...wcfg.pos);
      if (wcfg.rotY) wall.rotation.y = wcfg.rotY;
      wall.receiveShadow = true;
      scene.add(wall);
    });

    const baseboardH = 0.15;
    const baseboards = [
      { size: [w, baseboardH], pos: [0, baseboardH / 2, -hd + 0.01] },
      { size: [w, baseboardH], pos: [0, baseboardH / 2, hd - 0.01] },
      { size: [d, baseboardH], pos: [-hw + 0.01, baseboardH / 2, 0], rotY: Math.PI / 2 },
      { size: [d, baseboardH], pos: [hw - 0.01, baseboardH / 2, 0], rotY: Math.PI / 2 }
    ];

    baseboards.forEach((b) => {
      const bb = new THREE.Mesh(new THREE.PlaneGeometry(b.size[0], b.size[1]), trimMat);
      bb.position.set(...b.pos);
      if (b.rotY) bb.rotation.y = b.rotY;
      scene.add(bb);
    });

    addRoomFurniture(w, d, h);
  }

  function addRoomFurniture(w, d, h) {
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.75 });
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.7 });

    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), boxMat);
    crate.position.set(-6, 0.6, -6);
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);

    const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), tableMat);
    table.position.set(5, 0.75, 4);
    table.castShadow = true;
    scene.add(table);

    const legGeo = new THREE.BoxGeometry(0.1, 0.75, 0.1);
    [[-0.9, 3.5], [0.9, 3.5], [-0.9, 4.5], [0.9, 4.5]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, tableMat);
      leg.position.set(5 + lx, 0.375, lz);
      leg.castShadow = true;
      scene.add(leg);
    });

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, h, 12), boxMat);
    pillar.position.set(0, h / 2, 0);
    pillar.castShadow = true;
    scene.add(pillar);
  }

  function createStickman(color, showNameTag) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), mat);
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8), mat);
    body.position.y = 1.15;
    body.castShadow = true;
    group.add(body);

    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat);
    hip.position.y = 0.85;
    group.add(hip);

    function makeLimb(x, y, z, len, angleZ) {
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), mat);
      limb.position.set(x, y, z);
      limb.rotation.z = angleZ;
      limb.castShadow = true;
      return limb;
    }

    const leftArm = makeLimb(-0.22, 1.25, 0, 0.45, 0.4);
    const rightArm = makeLimb(0.22, 1.25, 0, 0.45, -0.4);
    const leftLeg = makeLimb(-0.1, 0.5, 0, 0.5, 0.1);
    const rightLeg = makeLimb(0.1, 0.5, 0, 0.5, -0.1);
    group.add(leftArm, rightArm, leftLeg, rightLeg);

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), darkMat);
    leftEye.position.set(-0.06, 1.58, -0.14);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), darkMat);
    rightEye.position.set(0.06, 1.58, -0.14);
    group.add(rightEye);

    let nameSprite = null;
    let nameCanvas = null;
    let nameTex = null;

    if (showNameTag) {
      nameCanvas = document.createElement('canvas');
      nameCanvas.width = 80;
      nameCanvas.height = 24;
      nameTex = new THREE.CanvasTexture(nameCanvas);
      nameSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthTest: false })
      );
      nameSprite.position.y = 2.05;
      nameSprite.scale.set(0.58, 0.18, 1);
      group.add(nameSprite);
    }

    group.userData = {
      limbs: { leftArm, rightArm, leftLeg, rightLeg },
      nameCanvas,
      nameTex,
      nameSprite,
      walkPhase: 0
    };

    initChatBubble(group);

    return group;
  }

  const BUBBLE_FONT = '20px Segoe UI, sans-serif';
  const BUBBLE_LINE_HEIGHT = 24;
  const BUBBLE_PAD_X = 14;
  const BUBBLE_PAD_Y = 10;
  const BUBBLE_MAX_CONTENT_W = 260;
  const BUBBLE_MIN_W = 40;
  const BUBBLE_MIN_H = 36;
  const BUBBLE_PIXEL_SCALE = 0.007;
  const BUBBLE_MAX_LINES = 4;

  function initChatBubble(group) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    sprite.position.y = 2.65;
    sprite.visible = false;
    group.add(sprite);

    group.userData.chatBubbleCanvas = canvas;
    group.userData.chatBubbleTex = tex;
    group.userData.chatBubbleSprite = sprite;
    group.userData.chatBubbleTimeout = null;
  }

  function wrapBubbleText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';

    function pushLongWord(word) {
      let chunk = '';
      for (const ch of word) {
        const test = chunk + ch;
        if (ctx.measureText(test).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = test;
        }
      }
      if (chunk) lines.push(chunk);
    }

    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth) {
        if (line) {
          lines.push(line);
          line = '';
        }
        if (ctx.measureText(word).width > maxWidth) {
          pushLongWord(word);
        } else {
          line = word;
        }
      } else {
        line = test;
      }
    });

    if (line) lines.push(line);
    return lines.slice(0, BUBBLE_MAX_LINES);
  }

  function measureBubbleSize(ctx, message) {
    const displayMsg = String(message).slice(0, 120);
    ctx.font = BUBBLE_FONT;

    const singleLineW = ctx.measureText(displayMsg).width;
    let lines;

    if (singleLineW <= BUBBLE_MAX_CONTENT_W) {
      lines = [displayMsg];
    } else {
      lines = wrapBubbleText(ctx, displayMsg, BUBBLE_MAX_CONTENT_W);
    }

    const contentW = Math.ceil(Math.max(...lines.map((ln) => ctx.measureText(ln).width), 1));
    const bubbleW = Math.max(BUBBLE_MIN_W, contentW + BUBBLE_PAD_X * 2);
    const bubbleH = Math.max(BUBBLE_MIN_H, lines.length * BUBBLE_LINE_HEIGHT + BUBBLE_PAD_Y * 2);

    return { lines, bubbleW, bubbleH };
  }

  function showChatBubble(mesh, message) {
    if (!mesh || !mesh.userData.chatBubbleSprite) return;

    const { chatBubbleCanvas, chatBubbleTex, chatBubbleSprite } = mesh.userData;
    const ctx = chatBubbleCanvas.getContext('2d');
    const { lines, bubbleW, bubbleH } = measureBubbleSize(ctx, message);
    const radius = Math.min(10, bubbleH / 2 - 1);

    chatBubbleCanvas.width = bubbleW;
    chatBubbleCanvas.height = bubbleH;

    ctx.clearRect(0, 0, bubbleW, bubbleH);
    ctx.font = BUBBLE_FONT;

    ctx.fillStyle = 'rgba(15, 17, 23, 0.88)';
    roundRect(ctx, 0, 0, bubbleW, bubbleH, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, bubbleW - 2, bubbleH - 2, radius - 1);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const startY = BUBBLE_PAD_Y + BUBBLE_LINE_HEIGHT / 2;
    lines.forEach((ln, i) => {
      ctx.fillText(ln, bubbleW / 2, startY + i * BUBBLE_LINE_HEIGHT);
    });

    chatBubbleTex.needsUpdate = true;
    chatBubbleSprite.visible = true;
    chatBubbleSprite.scale.set(
      bubbleW * BUBBLE_PIXEL_SCALE,
      bubbleH * BUBBLE_PIXEL_SCALE,
      1
    );

    if (mesh.userData.chatBubbleTimeout) {
      clearTimeout(mesh.userData.chatBubbleTimeout);
    }

    mesh.userData.chatBubbleTimeout = setTimeout(() => {
      chatBubbleSprite.visible = false;
      mesh.userData.chatBubbleTimeout = null;
    }, 5000);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function showPlayerChatBubble(playerId, message) {
    if (playerId === myId) {
      showChatBubble(localPlayerMesh, message);
      return;
    }
    const remote = otherPlayers.get(playerId);
    if (remote) showChatBubble(remote.mesh, message);
  }

  const NAME_TAG_FONT = 'bold 17px Segoe UI, sans-serif';
  const NAME_TAG_PAD_X = 11;
  const NAME_TAG_PAD_Y = 5;
  const NAME_TAG_MIN_W = 48;
  const NAME_TAG_H = 30;
  const NAME_TAG_PIXEL_SCALE = 0.0068;

  function updateNameTag(stickman, nickname) {
    if (!stickman.userData.nameCanvas) return;
    const { nameCanvas, nameTex, nameSprite } = stickman.userData;
    const ctx = nameCanvas.getContext('2d');
    const displayName = String(nickname).slice(0, 16);

    ctx.font = NAME_TAG_FONT;
    const textW = Math.ceil(ctx.measureText(displayName).width);
    const tagW = Math.max(NAME_TAG_MIN_W, textW + NAME_TAG_PAD_X * 2);
    const tagH = NAME_TAG_H;

    nameCanvas.width = tagW;
    nameCanvas.height = tagH;

    ctx.clearRect(0, 0, tagW, tagH);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    roundRect(ctx, 0, 0, tagW, tagH, 4);
    ctx.fill();

    ctx.font = NAME_TAG_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(displayName, tagW / 2, tagH / 2);

    nameTex.needsUpdate = true;
    nameSprite.scale.set(tagW * NAME_TAG_PIXEL_SCALE, tagH * NAME_TAG_PIXEL_SCALE, 1);
  }

  function getPlayerColor(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return new THREE.Color(`hsl(${hue}, 70%, 55%)`);
  }

  function createLocalPlayer() {
    if (localPlayerMesh) {
      scene.remove(localPlayerMesh);
    }
    const color = myId ? getPlayerColor(myId) : new THREE.Color(0x4fc3f7);
    localPlayerMesh = createStickman(color, false);
    localPlayerMesh.position.set(position.x, position.y, position.z);
    localPlayerMesh.rotation.y = yaw;
    scene.add(localPlayerMesh);
    applyCameraMode();
  }

  function addRemotePlayer(player) {
    if (player.id === myId || otherPlayers.has(player.id)) return;

    const color = getPlayerColor(player.id);
    const stickman = createStickman(color, true);
    stickman.position.set(player.position.x, player.position.y, player.position.z);
    stickman.rotation.y = player.position.rotationY || 0;
    scene.add(stickman);

    otherPlayers.set(player.id, {
      mesh: stickman,
      nickname: player.nickname,
      ping: player.ping || 0,
      isRunning: false,
      isJumping: false
    });

    remoteTargets.set(player.id, {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotationY: player.position.rotationY || 0,
      isRunning: false,
      isJumping: false
    });

    updateNameTag(stickman, player.nickname);
  }

  function clearChatBubble(mesh) {
    if (!mesh || !mesh.userData.chatBubbleSprite) return;
    if (mesh.userData.chatBubbleTimeout) {
      clearTimeout(mesh.userData.chatBubbleTimeout);
      mesh.userData.chatBubbleTimeout = null;
    }
    mesh.userData.chatBubbleSprite.visible = false;
  }

  function removeRemotePlayer(id) {
    const data = otherPlayers.get(id);
    if (data) {
      clearChatBubble(data.mesh);
      scene.remove(data.mesh);
      otherPlayers.delete(id);
    }
    remoteTargets.delete(id);
  }

  function animateStickman(stickman, running, jumping, dt) {
    const { limbs } = stickman.userData;
    if (jumping) {
      limbs.leftLeg.rotation.x = -0.5;
      limbs.rightLeg.rotation.x = 0.3;
      limbs.leftArm.rotation.x = -0.8;
      limbs.rightArm.rotation.x = -0.8;
      return;
    }

    if (running) {
      stickman.userData.walkPhase += dt * 12;
      const swing = Math.sin(stickman.userData.walkPhase) * 0.6;
      limbs.leftArm.rotation.x = swing;
      limbs.rightArm.rotation.x = -swing;
      limbs.leftLeg.rotation.x = -swing;
      limbs.rightLeg.rotation.x = swing;
    } else {
      stickman.userData.walkPhase += dt * 6;
      const swing = Math.sin(stickman.userData.walkPhase) * 0.25;
      limbs.leftArm.rotation.x = swing;
      limbs.rightArm.rotation.x = -swing;
      limbs.leftLeg.rotation.x = -swing * 0.5;
      limbs.rightLeg.rotation.x = swing * 0.5;
    }
  }

  function clampToRoom(x, z) {
    const margin = 0.5;
    const hw = roomData.width / 2 - margin;
    const hd = roomData.depth / 2 - margin;
    return {
      x: Math.max(-hw, Math.min(hw, x)),
      z: Math.max(-hd, Math.min(hd, z))
    };
  }

  function updateCamera() {
    if (isOrbitMode) {
      const pivotY = position.y + ORBIT_PIVOT_HEIGHT;
      const cosPitch = Math.cos(orbitPitch);
      const camX = position.x + ORBIT_DISTANCE * Math.sin(orbitYaw) * cosPitch;
      const camY = pivotY + ORBIT_DISTANCE * Math.sin(orbitPitch);
      const camZ = position.z + ORBIT_DISTANCE * Math.cos(orbitYaw) * cosPitch;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(position.x, pivotY, position.z);
      return;
    }

    const isTpp = settings.cameraMode === 'tpp';

    if (isTpp) {
      const offset = new THREE.Vector3(0, TPP_HEIGHT, TPP_DISTANCE);
      offset.applyEuler(new THREE.Euler(pitch * 0.4, yaw, 0, 'YXZ'));
      camera.position.set(
        position.x + offset.x,
        position.y + offset.y,
        position.z + offset.z
      );
      camera.lookAt(position.x, position.y + 1.4, position.z);
    } else {
      camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
  }

  function updateLocalStickman(dt) {
    if (!localPlayerMesh) return;

    localPlayerMesh.position.set(position.x, position.y, position.z);
    localPlayerMesh.rotation.y = yaw;
    animateStickman(localPlayerMesh, isRunning, isJumping, dt);
  }

  function updateMovement(dt) {
    if (!isPlaying || isPaused || !canControlMovement()) return;

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0));

    let moveX = 0;
    let moveZ = 0;
    isRunning = false;
    isJumping = !isGrounded;

    if (useMobileControls && hasJoystickInput()) {
      const jx = mobileStick.x;
      const jy = mobileStick.y;
      moveX += forward.x * (-jy) + right.x * jx;
      moveZ += forward.z * (-jy) + right.z * jx;
    } else {
      if (isActionPressed('forward')) {
        moveX += forward.x;
        moveZ += forward.z;
      }
      if (isActionPressed('backward')) {
        moveX -= forward.x;
        moveZ -= forward.z;
      }
      if (isActionPressed('left')) {
        moveX -= right.x;
        moveZ -= right.z;
      }
      if (isActionPressed('right')) {
        moveX += right.x;
        moveZ += right.z;
      }
    }

    const isMoving = moveX !== 0 || moveZ !== 0;
    let speed = WALK_SPEED;
    let goingBackward = false;

    if (isMoving) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len;
      moveZ /= len;

      if (useMobileControls && hasJoystickInput()) {
        goingBackward = mobileStick.y > 0.55 && Math.abs(mobileStick.x) < 0.35;
      } else {
        goingBackward = isActionPressed('backward') && !isActionPressed('forward');
      }

      if (goingBackward) {
        speed = BACK_SPEED;
      } else if (isActionPressed('run')) {
        speed = RUN_SPEED;
        isRunning = true;
      }
    }

    position.x += moveX * speed * dt;
    position.z += moveZ * speed * dt;

    const clamped = clampToRoom(position.x, position.z);
    position.x = clamped.x;
    position.z = clamped.z;

    if (isActionPressed('jump') && isGrounded) {
      velocityY = JUMP_FORCE;
      isGrounded = false;
      isJumping = true;
      mobileJumpQueued = false;
    }

    velocityY += GRAVITY * dt;
    position.y += velocityY * dt;

    if (position.y <= 0) {
      position.y = 0;
      velocityY = 0;
      isGrounded = true;
      isJumping = false;
    }

    updateCamera();
    updateLocalStickman(dt);

    const now = Date.now();
    if (now - lastMoveSent > 50) {
      lastMoveSent = now;
      socket.emit('playerMove', {
        x: position.x,
        y: position.y,
        z: position.z,
        rotationY: yaw,
        isRunning,
        isJumping
      });
    }
  }

  function updateRemotePlayers(dt) {
    remoteTargets.forEach((target, id) => {
      const data = otherPlayers.get(id);
      if (!data) return;

      const mesh = data.mesh;
      mesh.position.x += (target.x - mesh.position.x) * Math.min(1, dt * 12);
      mesh.position.y += (target.y - mesh.position.y) * Math.min(1, dt * 12);
      mesh.position.z += (target.z - mesh.position.z) * Math.min(1, dt * 12);

      let rotDiff = target.rotationY - mesh.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      mesh.rotation.y += rotDiff * Math.min(1, dt * 12);

      animateStickman(mesh, target.isRunning, target.isJumping, dt);
    });
  }

  function updatePlayerList(players) {
    playerListEl.innerHTML = '<h4>Players Online</h4>';
    players.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'player-list-item';
      const isMe = p.id === myId;
      item.innerHTML = `
        <span class="name ${isMe ? 'me' : ''}">${escapeHtml(p.nickname)}${isMe ? ' (kamu)' : ''}</span>
        <span class="ping-val">${p.ping} ms</span>
      `;
      playerListEl.appendChild(item);

      const remote = otherPlayers.get(p.id);
      if (remote) {
        remote.ping = p.ping;
        remote.nickname = p.nickname;
        updateNameTag(remote.mesh, p.nickname);
      }
    });

    const me = players.find((p) => p.id === myId);
    if (me) {
      myPingEl.textContent = `${me.ping} ms`;
      myPingEl.className = 'ping' + (me.ping > 200 ? ' bad' : me.ping > 100 ? ' high' : '');
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function addChatMessage(data) {
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="author">${escapeHtml(data.nickname)}:</span><span class="text">${escapeHtml(data.message)}</span>`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    while (chatMessages.children.length > 50) {
      chatMessages.removeChild(chatMessages.firstChild);
    }
  }

  function openChat() {
    if (!useMobileControls) document.exitPointerLock();
    chatInput.classList.add('active');
    chatInput.focus();
  }

  function closeChat() {
    chatInput.blur();
    chatInput.classList.remove('active');
    if (!isPaused && !useMobileControls) renderer.domElement.requestPointerLock();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  let lastTime = performance.now();

  function gameLoop() {
    requestAnimationFrame(gameLoop);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (isPlaying && !isPaused) {
      updateMovement(dt);
      updateRemotePlayers(dt);
    }

    renderer.render(scene, camera);
  }

  function startGame(nickname) {
    myNickname = nickname;
    myNicknameEl.textContent = myNickname;

    menuScreen.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    gameUI.classList.remove('hidden');
    gameUI.style.pointerEvents = useMobileControls ? 'auto' : 'none';

    isPlaying = true;
    isPaused = false;
    position.x = (Math.random() - 0.5) * 4;
    position.z = (Math.random() - 0.5) * 4;
    position.y = 0;

    createLocalPlayer();
    applyCameraMode();
    updateCamera();
    updateStatusBar();

    if (useMobileControls) {
      setMobileControlsVisible(true);
    } else {
      renderer.domElement.requestPointerLock();
    }
    socket.emit('setNickname', myNickname);

    if (!pingInterval) {
      pingInterval = setInterval(() => {
        socket.emit('ping', Date.now());
      }, 2000);
    }
  }

  playBtn.addEventListener('click', () => {
    const nick = nicknameInput.value.trim() || `Player${Math.floor(Math.random() * 9000) + 1000}`;
    startGame(nick);
  });

  nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      startGame(nicknameInput.value.trim() || `Player${Math.floor(Math.random() * 9000) + 1000}`);
    }
  });

  mainSettingsBtn.addEventListener('click', () => openSettings('menu'));
  pauseSettingsBtn.addEventListener('click', () => openSettings('pause'));
  resumeBtn.addEventListener('click', resumeGame);
  quitBtn.addEventListener('click', quitToMenu);
  settingsBackBtn.addEventListener('click', closeSettings);
  settingsResetBtn.addEventListener('click', () => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    saveSettings();
    buildSettingsUI();
    applyCameraMode();
    updateStatusBar();
  });

  function isPauseKey(e) {
    return e.code === settings.keybinds.pause;
  }

  document.addEventListener('keydown', (e) => {
    if (rebindingAction) {
      e.preventDefault();
      if (e.code === 'Escape') {
        rebindingAction = null;
        buildSettingsUI();
        return;
      }
      finishRebinding(e.code);
      return;
    }

    if (!settingsPanel.classList.contains('hidden')) {
      if (e.code === 'Escape' && !rebindingAction) {
        e.preventDefault();
        closeSettings();
      }
      return;
    }

    if (!isPlaying) return;

    if (document.activeElement === chatInput) {
      if (isPauseKey(e)) {
        e.preventDefault();
        closeChat();
      }
      return;
    }

    if (!isPaused && isPauseKey(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openPauseMenu();
      return;
    }

    if (isPaused) return;

    if (e.code === settings.keybinds.toggleCamera) {
      e.preventDefault();
      toggleCameraMode();
      return;
    }

    if (e.code === settings.keybinds.chat) {
      e.preventDefault();
      openChat();
      return;
    }

    if (e.code === settings.keybinds.voiceNote && !e.repeat) {
      e.preventDefault();
      startVoiceNote();
      return;
    }

    keys[e.code] = true;
  }, true);

  document.addEventListener('keyup', (e) => {
    if (rebindingAction || isPaused) return;
    if (e.code === settings.keybinds.voiceNote) {
      stopVoiceNote();
      return;
    }
    keys[e.code] = false;
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const msg = chatInput.value.trim();
      if (msg) {
        socket.emit('chatMessage', msg);
      }
      chatInput.value = '';
      closeChat();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    updateStatusBar();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPlaying || isPaused) return;

    if (isOrbitMode) {
      if (!(e.buttons & 2)) {
        exitOrbitMode();
        return;
      }
      orbitYaw -= e.movementX * 0.005;
      orbitPitch += e.movementY * 0.005;
      orbitPitch = Math.max(ORBIT_MIN_PITCH, Math.min(ORBIT_MAX_PITCH, orbitPitch));
      updateCamera();
      return;
    }

    if (!pointerLocked) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    updateCamera();
  });

  document.addEventListener('mousedown', (e) => {
    if (!isPlaying || isPaused) return;
    if (e.button !== 2) return;
    if (document.activeElement === chatInput) return;
    if (!settingsPanel.classList.contains('hidden')) return;
    if (!pauseMenu.classList.contains('hidden')) return;

    e.preventDefault();
    enterOrbitMode();
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 2) exitOrbitMode();
  });

  document.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    if (useMobileControls) return;
    if (
      isPlaying && !isPaused && !isOrbitMode &&
      document.pointerLockElement !== renderer.domElement &&
      document.activeElement !== chatInput &&
      settingsPanel.classList.contains('hidden') &&
      pauseMenu.classList.contains('hidden')
    ) {
      renderer.domElement.requestPointerLock();
    }
  });

  socket.on('init', (data) => {
    myId = data.id;
    myNickname = data.nickname;
    roomData = data.room;
    nicknameInput.value = data.nickname;

    createRoom(roomData.width, roomData.depth, roomData.height);
    data.players.forEach((p) => addRemotePlayer(p));
    if (isPlaying) createLocalPlayer();
  });

  socket.on('playerJoined', (player) => addRemotePlayer(player));
  socket.on('playerLeft', (data) => removeRemotePlayer(data.id));

  socket.on('playerMoved', (data) => {
    const target = remoteTargets.get(data.id);
    if (target) {
      target.x = data.position.x;
      target.y = data.position.y;
      target.z = data.position.z;
      target.rotationY = data.position.rotationY;
      target.isRunning = data.isRunning;
      target.isJumping = data.isJumping;
    }
  });

  socket.on('playerUpdated', (data) => {
    const remote = otherPlayers.get(data.id);
    if (remote) {
      remote.nickname = data.nickname;
      updateNameTag(remote.mesh, data.nickname);
    }
  });

  socket.on('playerList', (players) => updatePlayerList(players));

  socket.on('pong', (clientTime) => {
    const ping = Date.now() - clientTime;
    myPingEl.textContent = `${ping} ms`;
    myPingEl.className = 'ping' + (ping > 200 ? ' bad' : ping > 100 ? ' high' : '');
  });

  socket.on('chatMessage', (data) => {
    addChatMessage(data);
    showPlayerChatBubble(data.id, data.message);
  });

  socket.on('voiceNote', (data) => {
    playVoiceNote(data);
  });

  initThree();
  initMobileControls();
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  applyCameraMode();
  gameLoop();
})();