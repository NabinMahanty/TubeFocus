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

  const EDIT_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
  const DELETE_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
  const SAVE_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
  const TAG_ICON_SVG = `<svg class="category-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;

  /* ──────────────────────────────────────────────
   * STATE
   * ────────────────────────────────────────────── */

  let settings = null;
  let pomodoroInterval = null;
  let expandedCategories = {};

  /* ──────────────────────────────────────────────
   * SETTINGS PERSISTENCE
   * ────────────────────────────────────────────── */

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('tubefocus_settings', (result) => {
        settings = TubeFocusUtils.migrateSettings(result.tubefocus_settings);
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
    const container = document.getElementById('categories-list');
    if (!container) return;
    container.innerHTML = '';

    if (!settings.categoriesList || settings.categoriesList.length === 0) {
      container.innerHTML = `
        <div class="section-desc" style="text-align: center; padding: 12px; background: var(--bg-glass); border-radius: var(--radius-md);">
          No categories available. Create one above!
        </div>
      `;
      return;
    }

    for (const cat of settings.categoriesList) {
      const isExpanded = expandedCategories[cat.id] || false;
      const item = document.createElement('div');
      item.className = `custom-category-item${cat.enabled ? ' active' : ''}${isExpanded ? ' expanded' : ''}`;
      item.id = `cat-item-${cat.id}`;
      
      const keywordCount = cat.keywords ? cat.keywords.length : 0;
      
      item.innerHTML = `
        <div class="custom-category-header" data-id="${cat.id}">
          <div class="custom-category-main">
            <span class="custom-category-icon">${TAG_ICON_SVG}</span>
            <span class="custom-category-name" id="cat-name-text-${cat.id}">${cat.name}</span>
            <input type="text" class="text-input edit-cat-name-input" id="cat-name-input-${cat.id}" value="${cat.name}" style="display: none; padding: 4px 8px; font-size: 13px; font-weight: 600; width: 120px; height: auto; margin: 0;">
            <span class="custom-category-badge">${keywordCount} keyword${keywordCount === 1 ? '' : 's'}</span>
            <span class="chevron-icon">▼</span>
          </div>
          <div class="custom-category-actions">
            <button class="btn-icon edit-cat-btn" data-id="${cat.id}" title="Rename Category">${EDIT_ICON_SVG}</button>
            <label class="toggle-switch small" for="toggle-cat-${cat.id}">
              <input type="checkbox" id="toggle-cat-${cat.id}" class="toggle-cat" data-id="${cat.id}" ${cat.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <button class="btn-icon delete-cat" data-id="${cat.id}" title="Delete Category">${DELETE_ICON_SVG}</button>
          </div>
        </div>
        
        <div class="custom-category-keywords-section ${isExpanded ? '' : 'collapsed'}" id="keywords-sec-${cat.id}" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-subtle);">
          <div class="keyword-input-row" style="margin-bottom: 8px;">
            <input type="text" class="text-input cat-kw-input" data-id="${cat.id}" placeholder="Add keyword (e.g. chords, tutorial)">
            <button class="btn-add small btn-add-cat-kw" data-id="${cat.id}" style="width: 32px; height: 32px; font-size: 16px;">+</button>
          </div>
          <div class="tags-list cat-tags-list" data-id="${cat.id}">
            <!-- Tags for this category -->
          </div>
        </div>
      `;

      // Render tags for keywords in this category
      const tagsContainer = item.querySelector('.cat-tags-list');
      if (cat.keywords && cat.keywords.length > 0) {
        for (const kw of cat.keywords) {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.innerHTML = `
            ${kw}
            <button class="tag-remove cat-tag-remove" data-id="${cat.id}" data-keyword="${kw}">✕</button>
          `;
          tagsContainer.appendChild(tag);
        }
      }

      // 1. Expand/collapse listener (clicking the main header area)
      const mainHeader = item.querySelector('.custom-category-main');
      mainHeader.addEventListener('click', (e) => {
        // Only expand/collapse if not editing name
        const nameInput = item.querySelector(`#cat-name-input-${cat.id}`);
        if (nameInput.style.display !== 'none') return;

        expandedCategories[cat.id] = !expandedCategories[cat.id];
        const keywordsSection = item.querySelector('.custom-category-keywords-section');
        keywordsSection.classList.toggle('collapsed');
        item.classList.toggle('expanded');
      });

      // 2. Toggle category listener
      const toggle = item.querySelector('.toggle-cat');
      toggle.addEventListener('change', (e) => {
        e.stopPropagation();
        cat.enabled = e.target.checked;
        item.classList.toggle('active', cat.enabled);
        saveSettings();
      });

      // Avoid event propagation on toggle-switch wrapper click
      item.querySelector('.toggle-switch').addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // 3. Delete category listener
      const deleteBtn = item.querySelector('.delete-cat');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settings.categoriesList = settings.categoriesList.filter(c => c.id !== cat.id);
        delete expandedCategories[cat.id];
        saveSettings();
        renderCategories();
      });

      // 4. Add category keyword listener
      const kwInput = item.querySelector('.cat-kw-input');
      const addKwBtn = item.querySelector('.btn-add-cat-kw');

      function addCategoryKeyword() {
        const raw = kwInput.value.trim();
        if (!raw) return;
        
        const newKeywords = raw.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
        if (!cat.keywords) cat.keywords = [];

        for (const kw of newKeywords) {
          if (!cat.keywords.includes(kw)) {
            cat.keywords.push(kw);
          }
        }

        kwInput.value = '';
        saveSettings();
        renderCategories();
      }

      addKwBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addCategoryKeyword();
      });

      kwInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      kwInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          addCategoryKeyword();
        }
      });

      // 5. Remove category keyword listener
      item.querySelectorAll('.cat-tag-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const kw = btn.dataset.keyword;
          cat.keywords = cat.keywords.filter(k => k !== kw);
          saveSettings();
          renderCategories();
        });
      });

      // 6. Rename listener
      const editBtn = item.querySelector('.edit-cat-btn');
      const nameText = item.querySelector(`#cat-name-text-${cat.id}`);
      const nameInput = item.querySelector(`#cat-name-input-${cat.id}`);

      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isEditing = nameInput.style.display !== 'none';
        if (isEditing) {
          // Save the changes
          const newName = nameInput.value.trim();
          if (newName) {
            cat.name = newName;
            nameText.textContent = newName;
            saveSettings();
          }
          nameInput.style.display = 'none';
          nameText.style.display = '';
          editBtn.innerHTML = EDIT_ICON_SVG;
          editBtn.title = 'Rename Category';
        } else {
          // Enter editing mode
          nameText.style.display = 'none';
          nameInput.style.display = '';
          nameInput.focus();
          nameInput.select();
          editBtn.innerHTML = SAVE_ICON_SVG;
          editBtn.title = 'Save Name';
        }
      });

      nameInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      nameInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          editBtn.click();
        } else if (e.key === 'Escape') {
          nameInput.value = cat.name;
          nameInput.style.display = 'none';
          nameText.style.display = '';
          editBtn.innerHTML = EDIT_ICON_SVG;
          editBtn.title = 'Rename Category';
        }
      });

      container.appendChild(item);
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
   * Applies the saved theme (light or dark) to the page body.
   */
  function applyTheme() {
    const isLight = settings.theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (sunIcon && moonIcon) {
      if (isLight) {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      }
    }
  }

  /**
   * Syncs UI state with current settings.
   */
  function syncUI() {
    applyTheme();
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
    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        settings.theme = settings.theme === 'light' ? 'dark' : 'light';
        applyTheme();
        saveSettings();
      });
    }

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

        // Sync custom input value
        const customInput = document.getElementById('pomodoro-custom-input');
        if (customInput) customInput.value = minutes;

        updatePomodoroDisplay(minutes * 60);
        saveSettings();
      });
    });

    // Custom Pomodoro duration
    const pomodoroCustomInput = document.getElementById('pomodoro-custom-input');
    const applyCustomPomodoroBtn = document.getElementById('btn-apply-custom-pomodoro');

    if (pomodoroCustomInput && applyCustomPomodoroBtn) {
      const applyCustomTimer = () => {
        if (settings.pomodoro.isRunning) return;

        const val = parseInt(pomodoroCustomInput.value, 10);
        if (isNaN(val) || val < 1 || val > 1440) {
          pomodoroCustomInput.classList.add('shake');
          setTimeout(() => pomodoroCustomInput.classList.remove('shake'), 400);
          return;
        }

        settings.pomodoro.workMinutes = val;

        // Sync presets to show active if matching
        document.querySelectorAll('.preset-btn').forEach((btn) => {
          btn.classList.toggle('active', parseInt(btn.dataset.minutes, 10) === val);
        });

        updatePomodoroDisplay(val * 60);
        saveSettings();
      };

      applyCustomPomodoroBtn.addEventListener('click', applyCustomTimer);
      pomodoroCustomInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          applyCustomTimer();
        }
      });

      // Plus/Minus adjust button listeners
      const btnMinus = document.getElementById('btn-pomodoro-minus');
      const btnPlus = document.getElementById('btn-pomodoro-plus');
      if (btnMinus && btnPlus) {
        btnMinus.addEventListener('click', (e) => {
          e.stopPropagation();
          if (settings.pomodoro.isRunning) return;
          let val = parseInt(pomodoroCustomInput.value, 10);
          if (isNaN(val)) val = settings.pomodoro.workMinutes;
          if (val > 1) {
            pomodoroCustomInput.value = val - 1;
          }
        });

        btnPlus.addEventListener('click', (e) => {
          e.stopPropagation();
          if (settings.pomodoro.isRunning) return;
          let val = parseInt(pomodoroCustomInput.value, 10);
          if (isNaN(val)) val = settings.pomodoro.workMinutes;
          if (val < 1440) {
            pomodoroCustomInput.value = val + 1;
          }
        });
      }
    }

    // Custom Category Creator Listeners
    const catNameInput = document.getElementById('custom-category-name');
    const addCatBtn = document.getElementById('btn-add-category');

    if (catNameInput && addCatBtn) {
      const createCustomCategory = () => {
        const name = catNameInput.value.trim();
        if (!name) {
          catNameInput.classList.add('shake');
          setTimeout(() => catNameInput.classList.remove('shake'), 400);
          return;
        }

        const newCat = {
          id: 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: name,
          icon: '🏷️',
          keywords: [],
          enabled: true
        };

        if (!settings.categoriesList) {
          settings.categoriesList = [];
        }

        settings.categoriesList.push(newCat);
        expandedCategories[newCat.id] = true;

        catNameInput.value = '';

        saveSettings();
        renderCategories();
      };

      addCatBtn.addEventListener('click', createCustomCategory);
      catNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createCustomCategory();
      });
    }
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
    const isRunning = settings.pomodoro.isRunning;
    const customInput = document.getElementById('pomodoro-custom-input');
    const customBtn = document.getElementById('btn-apply-custom-pomodoro');
    const btnMinus = document.getElementById('btn-pomodoro-minus');
    const btnPlus = document.getElementById('btn-pomodoro-plus');

    if (customInput) {
      customInput.disabled = isRunning;
      if (!isRunning) {
        customInput.value = settings.pomodoro.workMinutes;
      }
    }
    if (customBtn) {
      customBtn.disabled = isRunning;
    }
    if (btnMinus) {
      btnMinus.disabled = isRunning;
    }
    if (btnPlus) {
      btnPlus.disabled = isRunning;
    }

    if (isRunning && settings.pomodoro.endTime) {
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

      const btn = document.getElementById('pomodoro-start');
      if (btn) {
        btn.classList.remove('running');
        document.getElementById('pomodoro-start-icon').textContent = '▶';
        document.getElementById('pomodoro-start-text').textContent = 'Start Focus';
      }
    }

    // Sync preset buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.disabled = isRunning;
      btn.style.opacity = isRunning ? '0.5' : '1';
      btn.style.cursor = isRunning ? 'not-allowed' : 'pointer';
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
