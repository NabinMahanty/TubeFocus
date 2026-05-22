/**
 * TubeFocus — Background Service Worker
 * Handles:
 * 1. Extension install/update events
 * 2. Pomodoro timer alarms
 * 3. Daily streak tracking
 * 4. Badge updates
 */

// ──────────────────────────────────────────────
// INSTALL / UPDATE
// ──────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[TubeFocus] Extension installed. Setting defaults.');

    // Set default settings on first install
    const defaults = {
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

    chrome.storage.sync.set({ tubefocus_settings: defaults });
  }

  if (details.reason === 'update') {
    console.log('[TubeFocus] Extension updated to', chrome.runtime.getManifest().version);
  }
});

// ──────────────────────────────────────────────
// BADGE MANAGEMENT
// ──────────────────────────────────────────────

/**
 * Updates the extension badge to reflect current state.
 * @param {boolean} enabled - Whether focus mode is active
 */
function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#6c3ce0' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ──────────────────────────────────────────────
// ALARM HANDLING (Pomodoro Timer)
// ──────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tubefocus-pomodoro') {
    // Timer completed
    const result = await chrome.storage.sync.get('tubefocus_settings');
    const settings = result.tubefocus_settings;

    if (!settings) return;

    if (settings.pomodoro.mode === 'work') {
      // Work session finished → switch to break
      settings.pomodoro.mode = 'break';
      settings.pomodoro.isRunning = false;
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
        } else if (!lastDate || lastDate.toDateString() !== today) {
          settings.stats.streak = 1;
        }
        settings.stats.lastActiveDate = today;
      }

      await chrome.storage.sync.set({ tubefocus_settings: settings });

      // Notify user
      // (Notifications require 'notifications' permission — skipping for now)
      console.log('[TubeFocus] Work session complete! Take a break.');
    } else {
      // Break finished → ready for next work session
      settings.pomodoro.mode = 'work';
      settings.pomodoro.isRunning = false;
      await chrome.storage.sync.set({ tubefocus_settings: settings });
      console.log('[TubeFocus] Break over! Ready for next session.');
    }
  }
});

// ──────────────────────────────────────────────
// MESSAGE HANDLING
// ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'UPDATE_BADGE':
      updateBadge(message.enabled);
      sendResponse({ success: true });
      break;

    case 'START_POMODORO': {
      const minutes = message.minutes || 25;
      chrome.alarms.create('tubefocus-pomodoro', {
        delayInMinutes: minutes,
      });
      sendResponse({ success: true });
      break;
    }

    case 'STOP_POMODORO':
      chrome.alarms.clear('tubefocus-pomodoro');
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
  return true;
});

// ──────────────────────────────────────────────
// STORAGE CHANGE LISTENER
// Update badge when settings change
// ──────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.tubefocus_settings) {
    const newSettings = changes.tubefocus_settings.newValue;
    if (newSettings) {
      updateBadge(newSettings.enabled);
    }
  }
});
