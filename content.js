/**
 * TubeFocus — Content Script
 * Injected into YouTube pages. Responsible for:
 * 1. Observing DOM mutations (YouTube's SPA renders content dynamically)
 * 2. Scanning video elements and applying show/hide decisions
 * 3. Communicating with the popup/background via chrome.runtime messages
 * 4. Maintaining real-time filtering as the user scrolls and navigates
 */

(() => {
  'use strict';

  /* ──────────────────────────────────────────────
   * STATE
   * ────────────────────────────────────────────── */

  let currentSettings = TubeFocusUtils.getDefaultSettings();
  let observer = null;
  let isProcessing = false;
  let stats = { total: 0, hidden: 0, shown: 0 };
  let lastUrl = location.href;

  /* ──────────────────────────────────────────────
   * SETTINGS MANAGEMENT
   * ────────────────────────────────────────────── */

  /**
   * Loads settings from chrome.storage.sync.
   * Falls back to defaults if nothing is stored.
   */
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('tubefocus_settings', (result) => {
        currentSettings = TubeFocusUtils.migrateSettings(result.tubefocus_settings);
        resolve(currentSettings);
      });
    });
  }

  /**
   * Saves current settings to chrome.storage.sync.
   */
  async function saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ tubefocus_settings: currentSettings }, resolve);
    });
  }

  /* ──────────────────────────────────────────────
   * DOM MANIPULATION — VIDEO FILTERING
   * ────────────────────────────────────────────── */

  /**
   * Hides a video element with a smooth transition.
   * Uses CSS classes so the injected stylesheet handles animation.
   * @param {Element} el - Video element to hide
   */
  function hideVideo(el) {
    if (!el.classList.contains('tubefocus-hidden')) {
      el.classList.add('tubefocus-hidden');
      el.setAttribute('data-tubefocus', 'hidden');
    }
  }

  /**
   * Shows a video element (removes hidden class).
   * @param {Element} el - Video element to show
   */
  function showVideo(el) {
    if (el.classList.contains('tubefocus-hidden')) {
      el.classList.remove('tubefocus-hidden');
      el.setAttribute('data-tubefocus', 'visible');
    }
  }

  /**
   * Core scanning function — iterates all video elements on the page
   * and applies the filtering decision from the filtering engine.
   */
  function scanAndFilterVideos() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      let totalVideos = 0;
      let hiddenVideos = 0;

      // Collect all video selectors into one query
      const allSelectors = Object.values(TubeFocusFilters.VIDEO_SELECTORS).join(', ');
      const videoElements = TubeFocusUtils.safeQueryAll(allSelectors);

      for (const videoEl of videoElements) {
        // Skip if already processed and settings haven't changed
        totalVideos++;

        const decision = TubeFocusFilters.shouldShowVideo(videoEl, currentSettings);

        if (decision.visible) {
          showVideo(videoEl);
        } else {
          hideVideo(videoEl);
          hiddenVideos++;
        }
      }

      // Handle shorts shelves separately (they are containers, not individual videos)
      if (currentSettings.enabled && currentSettings.hideShorts) {
        for (const selector of TubeFocusFilters.SHORTS_SELECTORS) {
          const shortsElements = TubeFocusUtils.safeQueryAll(selector);
          for (const el of shortsElements) {
            // Only hide shelf-level containers, not already-counted video items
            const isContainer = el.tagName.toLowerCase().includes('shelf') ||
                               el.tagName.toLowerCase().includes('reel');
            if (isContainer) {
              hideVideo(el);
            }
          }
        }
      } else if (!currentSettings.enabled || !currentSettings.hideShorts) {
        // Un-hide shorts when disabled
        for (const selector of TubeFocusFilters.SHORTS_SELECTORS) {
          const shortsElements = TubeFocusUtils.safeQueryAll(selector);
          for (const el of shortsElements) {
            showVideo(el);
          }
        }
      }

      // Hide the Shorts tab in the sidebar navigation
      if (currentSettings.enabled && currentSettings.hideShorts) {
        const guideEntries = TubeFocusUtils.safeQueryAll(
          'ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer'
        );
        for (const entry of guideEntries) {
          const title = (entry.textContent || '').toLowerCase();
          if (title.includes('shorts')) {
            hideVideo(entry);
          }
        }

        // Hide the Shorts button/tab in the chips bar
        const chipElements = TubeFocusUtils.safeQueryAll(
          'yt-chip-cloud-chip-renderer, ytd-feed-filter-chip-bar-renderer yt-chip-cloud-chip-renderer'
        );
        for (const chip of chipElements) {
          const text = (chip.textContent || '').toLowerCase();
          if (text.includes('shorts')) {
            hideVideo(chip);
          }
        }
      }

      // Update stats
      stats = { total: totalVideos, hidden: hiddenVideos, shown: totalVideos - hiddenVideos };

      // Update stored stats
      currentSettings.stats.videosHidden = (currentSettings.stats.videosHidden || 0) + hiddenVideos;

      // Send stats to popup if it's open
      try {
        chrome.runtime.sendMessage({
          type: 'STATS_UPDATE',
          data: {
            ...stats,
            focusScore: TubeFocusFilters.calculateFocusScore(totalVideos, hiddenVideos),
          },
        });
      } catch (e) {
        // Popup might not be open — that's fine
      }

    } finally {
      isProcessing = false;
    }
  }

  // Debounced version for MutationObserver callbacks
  const debouncedScan = TubeFocusUtils.debounce(scanAndFilterVideos, 150);

  // Throttled version for scroll events
  const throttledScan = TubeFocusUtils.throttle(scanAndFilterVideos, 500);

  /* ──────────────────────────────────────────────
   * MUTATION OBSERVER
   * YouTube is a React SPA — content is loaded dynamically.
   * We must watch for DOM changes and re-scan.
   * ────────────────────────────────────────────── */

  /**
   * Starts the MutationObserver on the page body.
   * Watches for new child nodes (video items being added).
   */
  function startObserver() {
    if (observer) {
      observer.disconnect();
    }

    const target = document.querySelector('ytd-app') || document.body;

    observer = new MutationObserver((mutations) => {
      // Only re-scan if relevant nodes were added
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldScan = true;
              break;
            }
          }
        }
        if (shouldScan) break;
      }

      if (shouldScan) {
        debouncedScan();
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
    });
  }

  /* ──────────────────────────────────────────────
   * URL CHANGE DETECTION
   * YouTube uses History API for navigation — page doesn't
   * actually reload. We detect URL changes to re-trigger scanning.
   * ────────────────────────────────────────────── */

  function checkUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Small delay to let YouTube render new content
      setTimeout(() => {
        scanAndFilterVideos();
      }, 800);
    }
  }

  // Poll for URL changes (History API doesn't fire reliably)
  setInterval(checkUrlChange, 1000);

  /* ──────────────────────────────────────────────
   * FOCUS BANNER
   * Shows a subtle top banner when Focus Mode is active.
   * ────────────────────────────────────────────── */

  function injectFocusBanner() {
    const existing = document.getElementById('tubefocus-banner');
    if (existing) existing.remove();

    if (!currentSettings.enabled) return;

    const banner = document.createElement('div');
    banner.id = 'tubefocus-banner';
    banner.innerHTML = `
      <div class="tubefocus-banner-content">
        <span class="tubefocus-banner-icon">🎯</span>
        <span class="tubefocus-banner-text">TubeFocus Active — Distraction-free mode is ON</span>
        <button class="tubefocus-banner-close" id="tubefocus-banner-close">✕</button>
      </div>
    `;
    document.body.prepend(banner);

    document.getElementById('tubefocus-banner-close')?.addEventListener('click', () => {
      banner.classList.add('tubefocus-banner-dismissed');
      setTimeout(() => banner.remove(), 300);
    });
  }

  /* ──────────────────────────────────────────────
   * MESSAGE HANDLING
   * Communication with popup.js and background.js.
   * ────────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SETTINGS_UPDATED':
        // Popup sent new settings — apply immediately
        currentSettings = TubeFocusUtils.migrateSettings(message.data);
        // Re-scan immediately
        scanAndFilterVideos();
        injectFocusBanner();
        sendResponse({ success: true });
        break;

      case 'GET_STATS':
        sendResponse({
          ...stats,
          focusScore: TubeFocusFilters.calculateFocusScore(stats.total, stats.hidden),
        });
        break;

      case 'PING':
        sendResponse({ alive: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
    return true; // Keep message channel open for async response
  });

  /* ──────────────────────────────────────────────
   * INITIALIZATION
   * ────────────────────────────────────────────── */

  async function init() {
    console.log('[TubeFocus] Initializing content script...');

    // Load stored settings
    await loadSettings();

    // Start observing DOM changes
    startObserver();

    // Initial scan
    scanAndFilterVideos();

    // Show focus banner if enabled
    injectFocusBanner();

    // Also scan on scroll (catches lazy-loaded content)
    window.addEventListener('scroll', throttledScan, { passive: true });

    // Listen for YouTube's own navigation events
    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(scanAndFilterVideos, 500);
    });

    console.log('[TubeFocus] Content script ready. Enabled:', currentSettings.enabled);
  }

  // Kick it off
  init();
})();
