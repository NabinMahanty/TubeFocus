/**
 * TubeFocus — Popup Script
 * Handles all UI interactions in the extension popup:
 * - Loading/saving settings
 * - Category toggles
 * - Custom keywords and whitelisted channels
 * - Pomodoro timer
 * - Stats display
 * - Communication with content script
 */

(() => {
  'use strict';

  /* ──────────────────────────────────────────────
   * CATEGORY DEFINITIONS
   * Each category has a display name, icon, and keyword count.
   * ────────────────────────────────────────────── */

  const CATEGORIES = [
    { key: 'education',         name: 'Education',         icon: '📖', keywords: 30 },
    { key: 'programming',       name: 'Programming',       icon: '💻', keywords: 55 },
    { key: 'ai_ml',             name: 'AI & ML',           icon: '🤖', keywords: 40 },
    { key: 'productivity',      name: 'Productivity',      icon: '🎯', keywords: 25 },
    { key: 'science',           name: 'Science',           icon: '🔬', keywords: 30 },
    { key: 'mathematics',       name: 'Mathematics',       icon: '📐', keywords: 25 },
    { key: 'upsc',              name: 'UPSC / IAS',        icon: '🏛️', keywords: 30 },
    { key: 'cds',               name: 'CDS / NDA',         icon: '🎖️', keywords: 15 },
    { key: 'jee_neet',          name: 'JEE / NEET',        icon: '⚛️', keywords: 30 },
    { key: 'coding_interviews', name: 'Coding Interviews', icon: '🧩', keywords: 20 },
    { key: 'language_learning', name: 'Languages',         icon: '🌐', keywords: 15 },
    { key: 'finance',           name: 'Finance',           icon: '💰', keywords: 25 },
  ];

  /* ──────────────────────────────────────────────
   * STATE
   * ────────────────────────────────────────────── */

  let settings = null;
  let pomodoroInterval = null;

  /* ──────────────────────────────────────────────
   * DEFAULT SETTINGS (mirrors helpers.js)
   * ────────────────────────────────────────────── */

  function getDefaultSettings() {
    return {
      enabled: false,
      hideShorts: true,
      strictMode: false,
      categories: {
        education: true,
        programming: true,
        upsc: false,
        cds: false,
        jee_neet: false,
        ai_ml: true,
        mathematics: false,
        science: false,
        productivity: true,
        coding_interviews: false,
        language_learning: false,
        finance: false,
      },
      customKeywords: [],
      whitelistedChannels: [],
      stats: {
        videosHidden: 0,
        focusSessions: 0,
        totalFocusMinutes: 0,
        streak: 0,
        lastActiveDate: null,
      },
      pomodoro: {
        workMinutes: 25,
        breakMinutes: 5,
        isRunning: false,
        endTime: null,
        mode: 'work',
      },
    };
  }

  /* ──────────────────────────────────────────────
   * SETTINGS PERSISTENCE
   * ────────────────────────────────────────────── */

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('tubefocus_settings', (result) => {
        if (result.tubefocus_settings) {
          settings = {
            ...getDefaultSettings(),
            ...result.tubefocus_settings,
            categories: {
              ...getDefaultSettings().categories,
              ...(result.tubefocus_settings.categories || {}),
            },
            stats: {
              ...getDefaultSettings().stats,
              ...(result.tubefocus_settings.stats || {}),
            },
            pomodoro: {
              ...getDefaultSettings().pomodoro,
              ...(result.tubefocus_settings.pomodoro || {}),
            },
          };
        } else {
          settings = getDefaultSettings();
        }
        resolve(settings);
      });
    });
  }

  async function saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ tubefocus_settings: settings }, () => {
        // Notify the content script that settings changed
        notifyContentScript();
        // Update badge
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', enabled: settings.enabled });
        resolve();
      });
    });
  }

  /**
   * Sends updated settings to the active YouTube tab's content script.
   */
  function notifyContentScript() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SETTINGS_UPDATED',
          data: settings,
        }).catch(() => {
          // Content script might not be loaded yet
        });
      }
    });
  }

  /* ──────────────────────────────────────────────
   * UI RENDERING
   * ────────────────────────────────────────────── */

  /**
   * Populates the category grid with cards.
   */
  function renderCategories() {
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = '';

    for (const cat of CATEGORIES) {
      const isActive = settings.categories[cat.key] || false;
      const card = document.createElement('div');
      card.className = `category-card${isActive ? ' active' : ''}`;
      card.dataset.category = cat.key;
      card.id = `category-${cat.key}`;
      card.innerHTML = `
        <input type="checkbox" ${isActive ? 'checked' : ''}>
        <span class="category-icon">${cat.icon}</span>
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-count">${cat.keywords}+ keywords</div>
        </div>
        <div class="category-check">
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;

      card.addEventListener('click', () => {
        const key = cat.key;
        settings.categories[key] = !settings.categories[key];
        card.classList.toggle('active');
        card.querySelector('input').checked = settings.categories[key];
        saveSettings();
      });

      grid.appendChild(card);
    }
  }

  /**
   * Renders the list of custom keywords as tags.
   */
  function renderCustomKeywords() {
    const container = document.getElementById('custom-keywords-list');
    container.innerHTML = '';

    for (const keyword of settings.customKeywords) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `
        ${keyword}
        <button class="tag-remove" data-keyword="${keyword}">✕</button>
      `;
      container.appendChild(tag);
    }

    // Attach remove listeners
    container.querySelectorAll('.tag-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const kw = btn.dataset.keyword;
        settings.customKeywords = settings.customKeywords.filter((k) => k !== kw);
        saveSettings();
        renderCustomKeywords();
      });
    });
  }

  /**
   * Renders the list of whitelisted channels as tags.
   */
  function renderWhitelistedChannels() {
    const container = document.getElementById('whitelisted-channels-list');
    container.innerHTML = '';

    for (const channel of settings.whitelistedChannels) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `
        ${channel}
        <button class="tag-remove" data-channel="${channel}">✕</button>
      `;
      container.appendChild(tag);
    }

    // Attach remove listeners
    container.querySelectorAll('.tag-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ch = btn.dataset.channel;
        settings.whitelistedChannels = settings.whitelistedChannels.filter((c) => c !== ch);
        saveSettings();
        renderWhitelistedChannels();
      });
    });
  }

  /**
   * Updates the focus score display and stats.
   */
  function updateStats(data) {
    const score = data?.focusScore ?? 100;
    document.getElementById('focus-score').textContent = score;
    document.getElementById('focus-score-fill').style.width = `${score}%`;

    document.getElementById('stat-hidden-count').textContent = data?.hidden ?? settings.stats.videosHidden ?? 0;
    document.getElementById('stat-sessions-count').textContent = settings.stats.focusSessions ?? 0;
    document.getElementById('stat-streak-count').textContent = settings.stats.streak ?? 0;

    // Format total focus time
    const totalMinutes = settings.stats.totalFocusMinutes ?? 0;
    let timeText;
    if (totalMinutes < 60) {
      timeText = `${Math.round(totalMinutes)}m`;
    } else {
      const hrs = Math.floor(totalMinutes / 60);
      const mins = Math.round(totalMinutes % 60);
      timeText = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    document.getElementById('stat-time-count').textContent = timeText;
  }

  /**
   * Syncs UI state with current settings.
   */
  function syncUI() {
    const container = document.getElementById('popup-container');
    const masterToggle = document.getElementById('master-toggle');

    masterToggle.checked = settings.enabled;

    if (settings.enabled) {
      container.classList.remove('disabled');
    } else {
      container.classList.add('disabled');
    }

    document.getElementById('toggle-shorts').checked = settings.hideShorts;
    document.getElementById('toggle-strict').checked = settings.strictMode;

    renderCategories();
    renderCustomKeywords();
    renderWhitelistedChannels();
    updateStats(null);
    syncPomodoroUI();
  }

  /* ──────────────────────────────────────────────
   * EVENT HANDLERS
   * ────────────────────────────────────────────── */

  function setupEventListeners() {
    // Master toggle
    document.getElementById('master-toggle').addEventListener('change', (e) => {
      settings.enabled = e.target.checked;
      const container = document.getElementById('popup-container');
      if (settings.enabled) {
        container.classList.remove('disabled');
      } else {
        container.classList.add('disabled');
      }
      saveSettings();
    });

    // Hide Shorts toggle
    document.getElementById('toggle-shorts').addEventListener('change', (e) => {
      settings.hideShorts = e.target.checked;
      saveSettings();
    });

    // Strict Mode toggle
    document.getElementById('toggle-strict').addEventListener('change', (e) => {
      settings.strictMode = e.target.checked;
      saveSettings();
    });

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active panel
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        document.getElementById(`panel-${tabId}`).classList.add('active');
      });
    });

    // Add custom keyword
    const keywordInput = document.getElementById('keyword-input');
    const addKeywordBtn = document.getElementById('btn-add-keyword');

    function addKeyword() {
      const raw = keywordInput.value.trim();
      if (!raw) return;

      // Support comma-separated keywords
      const newKeywords = raw.split(',').map((k) => k.trim()).filter((k) => k.length > 0);

      for (const kw of newKeywords) {
        if (!settings.customKeywords.includes(kw)) {
          settings.customKeywords.push(kw);
        }
      }

      keywordInput.value = '';
      saveSettings();
      renderCustomKeywords();
    }

    addKeywordBtn.addEventListener('click', addKeyword);
    keywordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addKeyword();
    });

    // Add whitelisted channel
    const channelInput = document.getElementById('channel-input');
    const addChannelBtn = document.getElementById('btn-add-channel');

    function addChannel() {
      const raw = channelInput.value.trim();
      if (!raw) return;

      const newChannels = raw.split(',').map((c) => c.trim()).filter((c) => c.length > 0);

      for (const ch of newChannels) {
        if (!settings.whitelistedChannels.includes(ch)) {
          settings.whitelistedChannels.push(ch);
        }
      }

      channelInput.value = '';
      saveSettings();
      renderWhitelistedChannels();
    }

    addChannelBtn.addEventListener('click', addChannel);
    channelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addChannel();
    });

    // Pomodoro controls
    document.getElementById('pomodoro-start').addEventListener('click', togglePomodoro);
    document.getElementById('pomodoro-reset').addEventListener('click', resetPomodoro);

    // Pomodoro presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (settings.pomodoro.isRunning) return;

        const minutes = parseInt(btn.dataset.minutes, 10);
        settings.pomodoro.workMinutes = minutes;

        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        updatePomodoroDisplay(minutes * 60);
        saveSettings();
      });
    });
  }

  /* ──────────────────────────────────────────────
   * POMODORO TIMER
   * ────────────────────────────────────────────── */

  function togglePomodoro() {
    if (settings.pomodoro.isRunning) {
      // Pause / Stop
      stopPomodoro();
    } else {
      // Start
      startPomodoro();
    }
  }

  function startPomodoro() {
    const minutes = settings.pomodoro.workMinutes;
    const endTime = Date.now() + minutes * 60 * 1000;

    settings.pomodoro.isRunning = true;
    settings.pomodoro.endTime = endTime;
    settings.pomodoro.mode = 'work';

    saveSettings();

    // Tell background to set alarm
    chrome.runtime.sendMessage({
      type: 'START_POMODORO',
      minutes: minutes,
    });

    startPomodoroCountdown(endTime);

    // Update button
    const btn = document.getElementById('pomodoro-start');
    btn.classList.add('running');
    document.getElementById('pomodoro-start-icon').textContent = '⏸';
    document.getElementById('pomodoro-start-text').textContent = 'Pause';
  }

  function stopPomodoro() {
    settings.pomodoro.isRunning = false;
    settings.pomodoro.endTime = null;

    saveSettings();

    chrome.runtime.sendMessage({ type: 'STOP_POMODORO' });

    if (pomodoroInterval) {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
    }

    const btn = document.getElementById('pomodoro-start');
    btn.classList.remove('running');
    document.getElementById('pomodoro-start-icon').textContent = '▶';
    document.getElementById('pomodoro-start-text').textContent = 'Start Focus';
  }

  function resetPomodoro() {
    stopPomodoro();
    const minutes = settings.pomodoro.workMinutes;
    updatePomodoroDisplay(minutes * 60);
    updatePomodoroProgress(1);
  }

  function startPomodoroCountdown(endTime) {
    const totalDuration = settings.pomodoro.workMinutes * 60 * 1000;

    if (pomodoroInterval) clearInterval(pomodoroInterval);

    pomodoroInterval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      const seconds = Math.ceil(remaining / 1000);

      updatePomodoroDisplay(seconds);

      // Update progress ring
      const progress = remaining / totalDuration;
      updatePomodoroProgress(progress);

      if (remaining <= 0) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        onPomodoroComplete();
      }
    }, 1000);
  }

  function updatePomodoroDisplay(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('pomodoro-time').textContent = display;
  }

  function updatePomodoroProgress(progress) {
    const circumference = 2 * Math.PI * 70; // r=70
    const offset = circumference * (1 - progress);
    document.getElementById('pomodoro-progress').style.strokeDashoffset = offset;
  }

  function onPomodoroComplete() {
    settings.pomodoro.isRunning = false;
    settings.pomodoro.endTime = null;
    settings.stats.focusSessions = (settings.stats.focusSessions || 0) + 1;
    settings.stats.totalFocusMinutes =
      (settings.stats.totalFocusMinutes || 0) + settings.pomodoro.workMinutes;

    // Update streak
    const today = new Date().toDateString();
    if (settings.stats.lastActiveDate !== today) {
      const lastDate = settings.stats.lastActiveDate
        ? new Date(settings.stats.lastActiveDate)
        : null;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate && lastDate.toDateString() === yesterday.toDateString()) {
        settings.stats.streak = (settings.stats.streak || 0) + 1;
      } else {
        settings.stats.streak = 1;
      }
      settings.stats.lastActiveDate = today;
    }

    saveSettings();
    updateStats(null);

    const btn = document.getElementById('pomodoro-start');
    btn.classList.remove('running');
    document.getElementById('pomodoro-start-icon').textContent = '▶';
    document.getElementById('pomodoro-start-text').textContent = 'Start Focus';
    document.getElementById('pomodoro-mode').textContent = 'DONE! 🎉';

    // Reset display after a moment
    setTimeout(() => {
      document.getElementById('pomodoro-mode').textContent = 'WORK';
      updatePomodoroDisplay(settings.pomodoro.workMinutes * 60);
      updatePomodoroProgress(1);
    }, 3000);
  }

  function syncPomodoroUI() {
    if (settings.pomodoro.isRunning && settings.pomodoro.endTime) {
      const remaining = settings.pomodoro.endTime - Date.now();
      if (remaining > 0) {
        startPomodoroCountdown(settings.pomodoro.endTime);
        const btn = document.getElementById('pomodoro-start');
        btn.classList.add('running');
        document.getElementById('pomodoro-start-icon').textContent = '⏸';
        document.getElementById('pomodoro-start-text').textContent = 'Pause';
      } else {
        // Timer expired while popup was closed
        onPomodoroComplete();
      }
    } else {
      updatePomodoroDisplay(settings.pomodoro.workMinutes * 60);
      updatePomodoroProgress(1);
    }

    // Sync preset buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.minutes, 10) === settings.pomodoro.workMinutes);
    });

    document.getElementById('pomodoro-mode').textContent =
      settings.pomodoro.mode === 'work' ? 'WORK' : 'BREAK';
  }

  /* ──────────────────────────────────────────────
   * STATS FROM CONTENT SCRIPT
   * ────────────────────────────────────────────── */

  function requestStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATS' }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script not available
            return;
          }
          if (response) {
            updateStats(response);
          }
        });
      }
    });
  }

  // Listen for real-time stats updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATS_UPDATE') {
      updateStats(message.data);
    }
  });

  /* ──────────────────────────────────────────────
   * ADD SVG GRADIENT FOR POMODORO
   * ────────────────────────────────────────────── */

  function addPomodoroGradient() {
    const svg = document.querySelector('.pomodoro-svg');
    if (!svg) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'pomodoroGrad');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#a855f7');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#06b6d4');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.prepend(defs);
  }

  /* ──────────────────────────────────────────────
   * INITIALIZATION
   * ────────────────────────────────────────────── */

  async function init() {
    await loadSettings();
    syncUI();
    setupEventListeners();
    addPomodoroGradient();
    requestStats();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
