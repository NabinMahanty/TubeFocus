/**
 * TubeFocus — Filtering Engine
 * Contains all keyword dictionaries, category mappings, and the core
 * logic that decides whether a video should be shown or hidden.
 */

const TubeFocusFilters = (() => {
  'use strict';

  /* ──────────────────────────────────────────────
   * CATEGORY KEYWORD DICTIONARIES
   * Each category maps to an array of keywords/phrases.
   * A video is considered "matching" a category if its title
   * or channel name contains any of these keywords.
   * ────────────────────────────────────────────── */

  const CATEGORY_KEYWORDS = {
    education: [
      'tutorial', 'course', 'lecture', 'lesson', 'educational', 'learn',
      'study', 'teaching', 'teacher', 'professor', 'class', 'academy',
      'explained', 'explanation', 'how to', 'guide', 'workshop',
      'training', 'fundamentals', 'basics', 'introduction to', 'intro to',
      'bootcamp', 'masterclass', 'deep dive', 'crash course',
      'khan academy', 'mit opencourseware', 'edx', 'coursera',
      'unacademy', 'byju', 'vedantu', 'nptel', 'skillshare',
    ],
    programming: [
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
    ],
    upsc: [
      'upsc', 'ias', 'ips', 'civil services', 'prelims', 'mains',
      'upsc preparation', 'upsc strategy', 'polity', 'indian polity',
      'laxmikant', 'indian economy', 'geography ncert', 'history ncert',
      'current affairs', 'general studies', 'csat', 'essay upsc',
      'upsc interview', 'optional subject', 'public administration',
      'drishti ias', 'vision ias', 'insights ias', 'vajiram',
      'shankar ias', 'byjus ias', 'unacademy upsc',
      'indian constitution', 'governance', 'international relations',
    ],
    cds: [
      'cds exam', 'cds preparation', 'combined defence services',
      'nda exam', 'nda preparation', 'indian army', 'indian navy',
      'indian air force', 'defence exam', 'ssb interview',
      'military', 'defence studies', 'afcat', 'capf',
      'territorial army', 'officer training',
    ],
    jee_neet: [
      'jee', 'jee mains', 'jee advanced', 'neet', 'neet preparation',
      'iit', 'iit jee', 'physics wallah', 'allen', 'resonance',
      'fiitjee', 'aakash', 'organic chemistry', 'inorganic chemistry',
      'physical chemistry', 'mechanics', 'thermodynamics',
      'electrodynamics', 'optics', 'modern physics', 'biology neet',
      'botany', 'zoology', 'ncert solutions', 'hc verma',
      'irodov', 'cengage', 'dc pandey', 'ms chauhan',
    ],
    ai_ml: [
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
    ],
    mathematics: [
      'mathematics', 'math', 'maths', 'calculus', 'algebra',
      'linear algebra', 'statistics', 'probability', 'geometry',
      'trigonometry', 'differential equations', 'discrete math',
      'number theory', 'combinatorics', 'topology',
      'mathematical', 'theorem', 'proof', 'equation',
      '3blue1brown', 'mathologer', 'numberphile', 'blackpenredpen',
      'professor leonard', 'khan academy math',
    ],
    science: [
      'science', 'physics', 'chemistry', 'biology', 'astronomy',
      'astrophysics', 'quantum', 'quantum mechanics', 'relativity',
      'evolution', 'genetics', 'microbiology', 'biochemistry',
      'neuroscience', 'ecology', 'geology', 'meteorology',
      'experiment', 'research', 'scientific', 'laboratory',
      'veritasium', 'vsauce', 'kurzgesagt', 'minutephysics',
      'smarter every day', 'mark rober', 'science channel',
      'national geographic', 'discovery', 'cosmos',
    ],
    productivity: [
      'productivity', 'time management', 'study tips', 'study with me',
      'pomodoro', 'goal setting', 'habit', 'morning routine',
      'organization', 'planning', 'bullet journal', 'notion',
      'obsidian', 'second brain', 'note taking', 'focus',
      'deep work', 'atomic habits', 'self improvement',
      'self discipline', 'motivation', 'mindfulness', 'meditation',
      'ali abdaal', 'thomas frank', 'matt d\'avella',
    ],
    coding_interviews: [
      'coding interview', 'technical interview', 'system design interview',
      'behavioral interview', 'faang', 'maang', 'google interview',
      'amazon interview', 'meta interview', 'apple interview',
      'microsoft interview', 'dsa', 'competitive programming',
      'codeforces', 'atcoder', 'interview preparation',
      'resume tips', 'portfolio', 'neetcode', 'striver',
      'take u forward', 'love babbar', 'apna college',
    ],
    language_learning: [
      'language learning', 'english speaking', 'english grammar',
      'ielts', 'toefl', 'duolingo', 'spanish', 'french', 'german',
      'japanese', 'korean', 'mandarin', 'vocabulary', 'pronunciation',
      'conversation practice', 'polyglot', 'language course',
    ],
    finance: [
      'finance', 'investing', 'stock market', 'mutual fund',
      'personal finance', 'budgeting', 'financial planning',
      'cryptocurrency', 'bitcoin', 'ethereum', 'trading',
      'passive income', 'wealth', 'tax planning', 'insurance',
      'ca foundation', 'chartered accountant', 'economics',
      'macroeconomics', 'microeconomics', 'gdp', 'inflation',
    ],
  };

  /* ──────────────────────────────────────────────
   * BLACKLIST KEYWORDS
   * Videos matching these are hidden in strict mode,
   * and deprioritized in normal mode.
   * ────────────────────────────────────────────── */

  const BLACKLIST_KEYWORDS = [
    'prank', 'roast', 'reaction', 'reacting', 'react to',
    'vlog', 'daily vlog', 'meme', 'memes', 'troll',
    'celebrity', 'gossip', 'drama', 'controversy',
    'gaming', 'gameplay', 'walkthrough', 'playthrough',
    'let\'s play', 'fortnite', 'minecraft gameplay', 'gta',
    'entertainment', 'funny', 'comedy', 'standup',
    'unboxing', 'haul', 'try on', 'asmr',
    'mukbang', 'eating show', 'challenge', 'dare',
    'shorts', 'tiktok', 'viral', 'trending',
    'clickbait', 'shocking', 'you won\'t believe',
    'gone wrong', 'exposed', 'caught', 'scandal',
    'relationship', 'dating', 'crush', 'ex girlfriend', 'ex boyfriend',
    'fight', 'beef', 'diss track',
  ];

  /* ──────────────────────────────────────────────
   * SHORTS-SPECIFIC SELECTORS
   * YouTube DOM selectors for Shorts content.
   * ────────────────────────────────────────────── */

  const SHORTS_SELECTORS = [
    'ytd-reel-shelf-renderer',           // Shorts shelf on homepage
    'ytd-rich-shelf-renderer[is-shorts]', // Alternative shorts shelf
    '[is-shorts]',                        // Generic shorts attribute
    'a[href*="/shorts/"]',               // Shorts links
  ];

  /* ──────────────────────────────────────────────
   * VIDEO ELEMENT SELECTORS
   * Selectors for different video containers across YouTube pages.
   * ────────────────────────────────────────────── */

  const VIDEO_SELECTORS = {
    // Homepage rich video items
    homepage: 'ytd-rich-item-renderer',
    // Search results
    search: 'ytd-video-renderer',
    // Sidebar / watch next recommendations
    sidebar: 'ytd-compact-video-renderer',
    // Grid items (channel pages, subscriptions)
    grid: 'ytd-grid-video-renderer',
    // Rich grid media (newer layout)
    richGrid: 'ytd-rich-grid-media',
    // Shelf renderers (sections)
    shelf: 'ytd-shelf-renderer',
    // Reel shelf (Shorts)
    reelShelf: 'ytd-reel-shelf-renderer',
    // Rich shelf (sometimes used for Shorts)
    richShelf: 'ytd-rich-shelf-renderer',
  };

  /* ──────────────────────────────────────────────
   * TITLE / CHANNEL SELECTORS
   * Where to find the video title and channel name within a video element.
   * ────────────────────────────────────────────── */

  const METADATA_SELECTORS = {
    title: [
      '#video-title',
      '#video-title-link',
      'a#video-title',
      'yt-formatted-string#video-title',
      '.title',
      'h3 a',
      'span#video-title',
    ],
    channel: [
      '#channel-name',
      'ytd-channel-name',
      '.ytd-channel-name',
      '#text.ytd-channel-name',
      'yt-formatted-string.ytd-channel-name',
      '#owner-name a',
      'a.yt-formatted-string[href*="/@"]',
      'a.yt-formatted-string[href*="/channel/"]',
    ],
  };

  /* ──────────────────────────────────────────────
   * CORE FILTERING FUNCTIONS
   * ────────────────────────────────────────────── */

  /**
   * Extracts the visible title text from a video element.
   * @param {Element} videoElement - The video DOM element
   * @returns {string} Title text or empty string
   */
  function getVideoTitle(videoElement) {
    for (const selector of METADATA_SELECTORS.title) {
      const el = videoElement.querySelector(selector);
      if (el) {
        const text = el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '';
        if (text.trim()) return text.trim();
      }
    }
    return '';
  }

  /**
   * Extracts the channel name from a video element.
   * @param {Element} videoElement - The video DOM element
   * @returns {string} Channel name or empty string
   */
  function getChannelName(videoElement) {
    for (const selector of METADATA_SELECTORS.channel) {
      const el = videoElement.querySelector(selector);
      if (el) {
        const text = el.textContent || '';
        if (text.trim()) return text.trim();
      }
    }
    return '';
  }

  /**
   * Checks if a video element is a Shorts video.
   * @param {Element} videoElement - The video DOM element
   * @returns {boolean}
   */
  function isShorts(videoElement) {
    // Check if the element itself is a shorts container
    if (videoElement.tagName.toLowerCase() === 'ytd-reel-shelf-renderer') return true;
    if (videoElement.hasAttribute('is-shorts')) return true;

    // Check for shorts links within the element
    const shortsLink = videoElement.querySelector('a[href*="/shorts/"]');
    if (shortsLink) return true;

    // Check overlay badge text
    const badges = videoElement.querySelectorAll(
      'ytd-badge-supported-renderer, .badge-style-type-simple, span.ytd-thumbnail-overlay-time-status-renderer'
    );
    for (const badge of badges) {
      const text = (badge.textContent || '').toLowerCase();
      if (text.includes('shorts')) return true;
    }

    return false;
  }

  /**
   * Determines whether a video should be visible based on the current settings.
   *
   * Decision logic:
   * 1. If the extension is disabled → show everything.
   * 2. If the channel is whitelisted → always show.
   * 3. If it's a Short and hideShorts is on → hide.
   * 4. In strict mode, if the video matches any blacklist keyword → hide.
   * 5. If the video matches any enabled category keyword → show.
   * 6. If the video matches any custom keyword → show.
   * 7. Otherwise → hide (nothing matched).
   *
   * @param {Element} videoElement - The video DOM element
   * @param {Object} settings - Current extension settings
   * @returns {{ visible: boolean, reason: string }}
   */
  function shouldShowVideo(videoElement, settings) {
    if (!settings.enabled) {
      return { visible: true, reason: 'disabled' };
    }

    const title = getVideoTitle(videoElement);
    const channel = getChannelName(videoElement);

    // If we can't extract any metadata, leave it visible to avoid hiding
    // content we can't analyze (e.g., ads, loading placeholders).
    if (!title && !channel) {
      return { visible: true, reason: 'no-metadata' };
    }

    const combinedText = `${title} ${channel}`;

    // Whitelisted channels are always shown
    if (channel && settings.whitelistedChannels && settings.whitelistedChannels.length > 0) {
      const normalizedChannel = TubeFocusUtils.normalizeText(channel);
      const isWhitelisted = settings.whitelistedChannels.some(wc =>
        normalizedChannel.includes(TubeFocusUtils.normalizeText(wc))
      );
      if (isWhitelisted) {
        return { visible: true, reason: 'whitelisted' };
      }
    }

    // Hide Shorts if the toggle is on
    if (settings.hideShorts && isShorts(videoElement)) {
      return { visible: false, reason: 'shorts' };
    }

    // Strict mode: blacklist check
    if (settings.strictMode) {
      if (TubeFocusUtils.containsKeyword(combinedText, BLACKLIST_KEYWORDS)) {
        return { visible: false, reason: 'blacklisted' };
      }
    }

    // Build allowed keywords from enabled categories
    const allowedKeywords = [];
    for (const [category, enabled] of Object.entries(settings.categories)) {
      if (enabled && CATEGORY_KEYWORDS[category]) {
        allowedKeywords.push(...CATEGORY_KEYWORDS[category]);
      }
    }

    // Add custom keywords
    if (settings.customKeywords && settings.customKeywords.length > 0) {
      allowedKeywords.push(...settings.customKeywords);
    }

    // If no categories are enabled, show everything (user hasn't configured)
    if (allowedKeywords.length === 0) {
      return { visible: true, reason: 'no-categories' };
    }

    // Check if the video matches any allowed keyword
    if (TubeFocusUtils.containsKeyword(combinedText, allowedKeywords)) {
      return { visible: true, reason: 'matched' };
    }

    // Default: hide unmatched content
    return { visible: false, reason: 'unmatched' };
  }

  /**
   * Calculates a "focus score" based on current page state.
   * Score = percentage of visible videos that are educational.
   * @param {number} totalVideos - Total videos on page
   * @param {number} hiddenVideos - Number of hidden videos
   * @returns {number} Score from 0 to 100
   */
  function calculateFocusScore(totalVideos, hiddenVideos) {
    if (totalVideos === 0) return 100;
    const visibleEducational = totalVideos - hiddenVideos;
    return Math.round((visibleEducational / totalVideos) * 100);
  }

  // Public API
  return {
    CATEGORY_KEYWORDS,
    BLACKLIST_KEYWORDS,
    SHORTS_SELECTORS,
    VIDEO_SELECTORS,
    METADATA_SELECTORS,
    getVideoTitle,
    getChannelName,
    isShorts,
    shouldShowVideo,
    calculateFocusScore,
  };
})();
