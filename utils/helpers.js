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

  const DEFAULT_CATEGORIES = [
    {
      id: 'education',
      name: 'Education',
      icon: '📖',
      enabled: true,
      keywords: [
        'tutorial', 'course', 'lecture', 'lesson', 'educational', 'learn',
        'study', 'teaching', 'teacher', 'professor', 'class', 'academy',
        'explained', 'explanation', 'how to', 'guide', 'workshop',
        'training', 'fundamentals', 'basics', 'introduction to', 'intro to',
        'bootcamp', 'masterclass', 'deep dive', 'crash course',
        'khan academy', 'mit opencourseware', 'edx', 'coursera',
        'unacademy', 'byju', 'vedantu', 'nptel', 'skillshare',
      ]
    },
    {
      id: 'programming',
      name: 'Programming',
      icon: '💻',
      enabled: true,
      keywords: [
        'programming', 'coding', 'code', 'developer', 'development',
        'software', 'web dev', 'frontend', 'backend', 'full stack',
        'fullstack', 'python', 'javascript', 'typescript', 'java', 'c++',
        'rust', 'golang', 'react', 'angular', 'vue', 'node.js', 'nodejs',
        'django', 'flask', 'spring boot', 'docker', 'kubernetes',
        'devops', 'git', 'github', 'api', 'rest api', 'graphql',
        'database', 'sql', 'mongodb', 'redis', 'aws', 'azure', 'gcp',
        'cloud computing', 'microservices', 'system design',
        'data structures', 'algorithms', 'leetcode', 'hackerrank',
        'freecodecamp', 'traversy media', 'fireship', 'tech with tim',
        'corey schafer', 'sentdex', 'the coding train',
        'html', 'css', 'tailwind', 'next.js', 'nextjs', 'vite',
        'webpack', 'compiler', 'interpreter', 'debugging', 'testing',
        'unit test', 'ci cd', 'linux', 'terminal', 'command line',
      ]
    },
    {
      id: 'upsc',
      name: 'UPSC / IAS',
      icon: '🏛️',
      enabled: false,
      keywords: [
        'upsc', 'ias', 'ips', 'civil services', 'prelims', 'mains',
        'upsc preparation', 'upsc strategy', 'polity', 'indian polity',
        'laxmikant', 'indian economy', 'geography ncert', 'history ncert',
        'current affairs', 'general studies', 'csat', 'essay upsc',
        'upsc interview', 'optional subject', 'public administration',
        'drishti ias', 'vision ias', 'insights ias', 'vajiram',
        'shankar ias', 'byjus ias', 'unacademy upsc',
        'indian constitution', 'governance', 'international relations',
      ]
    },
    {
      id: 'cds',
      name: 'CDS / NDA',
      icon: '🎖️',
      enabled: false,
      keywords: [
        'cds exam', 'cds preparation', 'combined defence services',
        'nda exam', 'nda preparation', 'indian army', 'indian navy',
        'indian air force', 'defence exam', 'ssb interview',
        'military', 'defence studies', 'afcat', 'capf',
        'territorial army', 'officer training',
      ]
    },
    {
      id: 'jee_neet',
      name: 'JEE / NEET',
      icon: '⚛️',
      enabled: false,
      keywords: [
        'jee', 'jee mains', 'jee advanced', 'neet', 'neet preparation',
        'iit', 'iit jee', 'physics wallah', 'allen', 'resonance',
        'fiitjee', 'aakash', 'organic chemistry', 'inorganic chemistry',
        'physical chemistry', 'mechanics', 'thermodynamics',
        'electrodynamics', 'optics', 'modern physics', 'biology neet',
        'botany', 'zoology', 'ncert solutions', 'hc verma',
        'irodov', 'cengage', 'dc pandey', 'ms chauhan',
      ]
    },
    {
      id: 'ai_ml',
      name: 'AI & ML',
      icon: '🤖',
      enabled: true,
      keywords: [
        'artificial intelligence', 'machine learning', 'deep learning',
        'neural network', 'natural language processing', 'nlp',
        'computer vision', 'reinforcement learning', 'tensorflow',
        'pytorch', 'keras', 'scikit-learn', 'data science',
        'data analysis', 'data engineering', 'big data', 'pandas',
        'numpy', 'matplotlib', 'jupyter', 'kaggle', 'hugging face',
        'transformer', 'bert', 'gpt', 'llm', 'large language model',
        'generative ai', 'stable diffusion', 'midjourney',
        'openai', 'google deepmind', 'research paper',
        'arxiv', 'ai news', 'ml ops', 'mlops', 'feature engineering',
        'model training', 'fine tuning', 'prompt engineering',
        'rag', 'vector database', 'embeddings', 'langchain',
      ]
    },
    {
      id: 'mathematics',
      name: 'Mathematics',
      icon: '📐',
      enabled: false,
      keywords: [
        'mathematics', 'math', 'maths', 'calculus', 'algebra',
        'linear algebra', 'statistics', 'probability', 'geometry',
        'trigonometry', 'differential equations', 'discrete math',
        'number theory', 'combinatorics', 'topology',
        'mathematical', 'theorem', 'proof', 'equation',
        '3blue1brown', 'mathologer', 'numberphile', 'blackpenredpen',
        'professor leonard', 'khan academy math',
      ]
    },
    {
      id: 'science',
      name: 'Science',
      icon: '🔬',
      enabled: false,
      keywords: [
        'science', 'physics', 'chemistry', 'biology', 'astronomy',
        'astrophysics', 'quantum', 'quantum mechanics', 'relativity',
        'evolution', 'genetics', 'microbiology', 'biochemistry',
        'neuroscience', 'ecology', 'geology', 'meteorology',
        'experiment', 'research', 'scientific', 'laboratory',
        'veritasium', 'vsauce', 'kurzgesagt', 'minutephysics',
        'smarter every day', 'mark rober', 'science channel',
        'national geographic', 'discovery', 'cosmos',
      ]
    },
    {
      id: 'productivity',
      name: 'Productivity',
      icon: '🎯',
      enabled: true,
      keywords: [
        'productivity', 'time management', 'study tips', 'study with me',
        'pomodoro', 'goal setting', 'habit', 'morning routine',
        'organization', 'planning', 'bullet journal', 'notion',
        'obsidian', 'second brain', 'note taking', 'focus',
        'deep work', 'atomic habits', 'self improvement',
        'self discipline', 'motivation', 'mindfulness', 'meditation',
        'ali abdaal', 'thomas frank', 'matt d\'avella',
      ]
    },
    {
      id: 'coding_interviews',
      name: 'Coding Interviews',
      icon: '🧩',
      enabled: false,
      keywords: [
        'coding interview', 'technical interview', 'system design interview',
        'behavioral interview', 'faang', 'maang', 'google interview',
        'amazon interview', 'meta interview', 'apple interview',
        'microsoft interview', 'dsa', 'competitive programming',
        'codeforces', 'atcoder', 'interview preparation',
        'resume tips', 'portfolio', 'neetcode', 'striver',
        'take u forward', 'love babbar', 'apna college',
      ]
    },
    {
      id: 'language_learning',
      name: 'Languages',
      icon: '🌐',
      enabled: false,
      keywords: [
        'language learning', 'english speaking', 'english grammar',
        'ielts', 'toefl', 'duolingo', 'spanish', 'french', 'german',
        'japanese', 'korean', 'mandarin', 'vocabulary', 'pronunciation',
        'conversation practice', 'polyglot', 'language course',
      ]
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: '💰',
      enabled: false,
      keywords: [
        'finance', 'investing', 'stock market', 'mutual fund',
        'personal finance', 'budgeting', 'financial planning',
        'cryptocurrency', 'bitcoin', 'ethereum', 'trading',
        'passive income', 'wealth', 'tax planning', 'insurance',
        'ca foundation', 'chartered accountant', 'economics',
        'macroeconomics', 'microeconomics', 'gdp', 'inflation',
      ]
    }
  ];

  /**
   * Returns the default settings object for TubeFocus.
   * Used when no stored preferences exist.
   * @returns {Object} Default settings
   */
  function getDefaultSettings() {
    return {
      enabled: false,
      theme: 'dark',
      hideShorts: true,
      strictMode: false,
      categoriesList: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
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

  /**
   * Migrates older settings schemas to the unified categoriesList schema.
   */
  function migrateSettings(rawSettings) {
    if (!rawSettings) return getDefaultSettings();

    let categoriesList = rawSettings.categoriesList;
    if (!categoriesList) {
      categoriesList = [];

      // 1. Convert old default categories using their old toggle states
      const defaults = DEFAULT_CATEGORIES;
      for (const defaultCat of defaults) {
        const wasEnabled = rawSettings.categories
          ? rawSettings.categories[defaultCat.id]
          : defaultCat.enabled;
        categoriesList.push({
          id: defaultCat.id,
          name: defaultCat.name,
          icon: defaultCat.icon,
          keywords: [...defaultCat.keywords],
          enabled: wasEnabled !== undefined ? wasEnabled : defaultCat.enabled,
        });
      }

      // 2. Convert old customCategories array if it exists
      if (rawSettings.customCategories) {
        for (const customCat of rawSettings.customCategories) {
          if (!categoriesList.some(c => c.id === customCat.id)) {
            categoriesList.push({
              id: customCat.id,
              name: customCat.name,
              icon: customCat.icon || '🏷️',
              keywords: customCat.keywords || [],
              enabled: customCat.enabled !== undefined ? customCat.enabled : true,
            });
          }
        }
      }
    }

    return {
      ...getDefaultSettings(),
      ...rawSettings,
      categoriesList: categoriesList,
      stats: {
        ...getDefaultSettings().stats,
        ...(rawSettings.stats || {}),
      },
      pomodoro: {
        ...getDefaultSettings().pomodoro,
        ...(rawSettings.pomodoro || {}),
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
    migrateSettings,
    formatTime,
    uid,
    DEFAULT_CATEGORIES,
  };
})();
