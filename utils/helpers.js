/**
 * TubeFocus — Utility Helpers
 * Shared utility functions used across the extension.
 */

const TubeFocusUtils = (() => {
  'use strict';

  /**
   * Debounce function — limits how often a function fires.
   * Critical for performance when handling MutationObserver callbacks.
   * @param {Function} fn - The function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, delay = 200) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Throttle function — ensures a function fires at most once per interval.
   * Useful for scroll-based or rapid-fire events.
   * @param {Function} fn - The function to throttle
   * @param {number} limit - Minimum interval in milliseconds
   * @returns {Function} Throttled function
   */
  function throttle(fn, limit = 300) {
    let inThrottle = false;
    let lastArgs = null;
    let lastThis = null;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
          if (lastArgs) {
            fn.apply(lastThis, lastArgs);
            lastArgs = null;
            lastThis = null;
          }
        }, limit);
      } else {
        lastArgs = args;
        lastThis = this;
      }
    };
  }

  /**
   * Normalizes text for keyword matching.
   * Lowercases, removes extra whitespace, and strips special characters.
   * @param {string} text - Raw text to normalize
   * @returns {string} Cleaned text
   */
  function normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks if any keyword from a list exists in the given text.
   * Uses word boundary-aware matching to reduce false positives.
   * @param {string} text - The text to search in
   * @param {string[]} keywords - Array of keywords to look for
   * @returns {boolean} True if any keyword is found
   */
  function containsKeyword(text, keywords) {
    if (!text || !keywords || keywords.length === 0) return false;
    const normalized = normalizeText(text);
    return keywords.some(keyword => {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) return false;
      // Use word boundary matching for short keywords to avoid false positives
      if (normalizedKeyword.length <= 3) {
        const regex = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i');
        return regex.test(normalized);
      }
      return normalized.includes(normalizedKeyword);
    });
  }

  /**
   * Escapes special regex characters in a string.
   * @param {string} str - String to escape
   * @returns {string} Regex-safe string
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Safely queries the DOM, returning null instead of throwing.
   * @param {string} selector - CSS selector
   * @param {Element} [parent=document] - Parent element to query within
   * @returns {Element|null}
   */
  function safeQuery(selector, parent = document) {
    try {
      return parent.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  /**
   * Safely queries all matching DOM elements, returning empty array on failure.
   * @param {string} selector - CSS selector
   * @param {Element} [parent=document] - Parent element to query within
   * @returns {Element[]}
   */
  function safeQueryAll(selector, parent = document) {
    try {
      return Array.from(parent.querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  /**
   * Returns the default settings object for TubeFocus.
   * Used when no stored preferences exist.
   * @returns {Object} Default settings
   */
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
        mode: 'work', // 'work' or 'break'
      },
    };
  }

  /**
   * Formats minutes into a human-readable string.
   * @param {number} minutes - Total minutes
   * @returns {string} Formatted time string (e.g., "2h 30m")
   */
  function formatTime(minutes) {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  /**
   * Generates a simple unique ID.
   * @returns {string}
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    debounce,
    throttle,
    normalizeText,
    containsKeyword,
    escapeRegex,
    safeQuery,
    safeQueryAll,
    getDefaultSettings,
    formatTime,
    uid,
  };
})();
