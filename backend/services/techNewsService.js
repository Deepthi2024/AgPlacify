/**
 * Placify AI — General Real-World Tech News Service
 * Integrates with NewsAPI (https://newsapi.org)
 * Features:
 * - Completely independent of user Placify profile/domain
 * - 8 Optional user-selectable Tech News filters (All, AI, ML, Data Science, Full-Stack, Cloud & DevOps, Cybersecurity, Mobile)
 * - Server-side strict relevance filtering (filters out non-tech noise, sports, politics, war)
 * - Honest topic labeling (no fake topic assignments)
 * - Deduplication by normalized URL and title
 * - Relative timestamp formatting ("2 hours ago", "Yesterday", etc.)
 * - Backend TTL caching (15 min TTL per filter/query)
 */

const https = require('https');

// Simple In-Memory TTL Cache
const newsCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Filter Display Names
 */
const FILTER_DISPLAY_NAMES = {
  all: 'All Technology',
  ai: 'Artificial Intelligence',
  'machine-learning': 'Machine Learning',
  'data-science': 'Data Science',
  'full-stack': 'Full-Stack Web Development',
  'cloud-devops': 'Cloud & DevOps',
  cybersecurity: 'Cybersecurity',
  'mobile-development': 'Mobile Development'
};

/**
 * Keywords per Filter
 */
const NEWS_FILTER_KEYWORDS = {
  all: [
    'technology', 'software', 'artificial intelligence', 'cloud computing',
    'cybersecurity', 'programming', 'semiconductors', 'mobile apps', 'developer tools'
  ],
  ai: [
    'artificial intelligence', 'generative AI', 'large language models', 'LLM',
    'AI agents', 'RAG', 'OpenAI', 'Anthropic', 'Google AI', 'AI models', 'AI research'
  ],
  'machine-learning': [
    'machine learning', 'deep learning', 'neural networks', 'model training',
    'ML', 'computer vision', 'natural language processing', 'MLOps'
  ],
  'data-science': [
    'data science', 'data analytics', 'big data', 'data engineering',
    'data visualization', 'data platforms', 'Databricks', 'Apache Spark', 'pandas'
  ],
  'full-stack': [
    'web development', 'frontend', 'backend', 'JavaScript', 'TypeScript',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Next.js', 'APIs', 'web frameworks'
  ],
  'cloud-devops': [
    'cloud computing', 'AWS', 'Azure', 'Google Cloud', 'Kubernetes', 'Docker',
    'Terraform', 'DevOps', 'CI/CD', 'serverless', 'containers'
  ],
  cybersecurity: [
    'cybersecurity', 'cyber security', 'information security', 'network security',
    'application security', 'cloud security', 'vulnerabilities', 'zero trust',
    'ransomware', 'threat intelligence', 'ethical hacking', 'security operations'
  ],
  'mobile-development': [
    'Android', 'iOS', 'Flutter', 'React Native', 'Kotlin', 'Swift',
    'mobile development', 'mobile apps'
  ]
};

/**
 * Exclusion terms for non-technology content
 */
const NON_TECH_EXCLUDE_TERMS = [
  'football', 'soccer', 'serie a', 'premier league', 'la liga', 'champions league',
  'cricket', 'ipl', 'nfl', 'nba', 'mlb', 'tennis', 'formula 1', 'grand prix', 'racing',
  'boxing', 'ufc', 'gossip', 'celebrity', 'hollywood', 'bollywood', 'box office',
  'election', 'parliament', 'senate', 'biden', 'trump', 'political', 'politics'
];

/**
 * Normalizes filter parameter to valid key
 */
function normalizeFilterKey(rawFilter) {
  const clean = String(rawFilter || '').trim().toLowerCase();
  if (clean === 'ai' || clean === 'artificial intelligence' || clean === 'artificial-intelligence') return 'ai';
  if (clean === 'machine-learning' || clean === 'machine learning' || clean === 'ml') return 'machine-learning';
  if (clean === 'data-science' || clean === 'data science') return 'data-science';
  if (clean === 'full-stack' || clean === 'fullstack' || clean === 'web development' || clean === 'full-stack web development') return 'full-stack';
  if (clean === 'cloud-devops' || clean === 'cloud & devops' || clean === 'devops' || clean === 'cloud') return 'cloud-devops';
  if (clean === 'cybersecurity' || clean === 'cyber security' || clean === 'security') return 'cybersecurity';
  if (clean === 'mobile-development' || clean === 'mobile' || clean === 'mobile development') return 'mobile-development';
  return 'all';
}

/**
 * Helper: Human-readable relative time
 */
function formatRelativeTime(isoString) {
  if (!isoString) return 'Recently';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Helper: HTTPS GET Request
 */
function httpsGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, { headers: { 'User-Agent': 'PlacifyAI/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON from News API provider'));
          }
        } else {
          try {
            const errJson = JSON.parse(data);
            reject(new Error(errJson.message || `News API error HTTP ${res.statusCode}`));
          } catch (e) {
            reject(new Error(`News API provider returned HTTP ${res.statusCode}`));
          }
        }
      });
    }).on('error', err => reject(err));
  });
}

/**
 * Server-Side Strict Relevance & Topic Validation
 */
function validateArticleRelevance(item, filterKey, keywords) {
  const titleLower = (item.title || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  const fullText = `${titleLower} ${descLower}`;

  // 1. Exclude non-technology noise
  for (const term of NON_TECH_EXCLUDE_TERMS) {
    if (fullText.includes(term)) {
      return { isValid: false };
    }
  }

  // 2. Validate Domain Filter Match
  if (filterKey !== 'all') {
    const hasMatch = keywords.some(kw => fullText.includes(kw.toLowerCase()));
    if (!hasMatch) {
      return { isValid: false };
    }
    return {
      isValid: true,
      topic: FILTER_DISPLAY_NAMES[filterKey]
    };
  }

  // 3. For 'all' filter, check general tech keywords
  let matchedTopic = null;
  for (const [key, kwList] of Object.entries(NEWS_FILTER_KEYWORDS)) {
    if (key === 'all') continue;
    if (kwList.some(kw => fullText.includes(kw.toLowerCase()))) {
      matchedTopic = FILTER_DISPLAY_NAMES[key];
      break;
    }
  }

  return {
    isValid: true,
    topic: matchedTopic
  };
}

/**
 * Main Service: Fetch General / Filtered Tech News
 */
async function fetchPersonalizedTechNews({ domain: rawFilter = 'all', searchQuery = '', sort = 'latest', page = 1 }) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('NEWS_API_KEY is not configured in backend environment.');
  }

  const filterKey = normalizeFilterKey(rawFilter);
  const filterDisplayName = FILTER_DISPLAY_NAMES[filterKey] || 'All Technology';
  const keywords = NEWS_FILTER_KEYWORDS[filterKey] || NEWS_FILTER_KEYWORDS.all;

  const cacheKey = `tech-news:${filterKey}:${searchQuery.trim().toLowerCase()}:${sort}:${page}`;
  const cached = newsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  let apiUrl;

  if (filterKey === 'all' && !searchQuery.trim()) {
    // For default "All" headlines, fetch top technology headlines
    apiUrl = `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=40&apiKey=${apiKey}`;
  } else {
    // Build controlled query for specific domain filter or search query
    let queryTerms;
    if (filterKey === 'all') {
      queryTerms = keywords.slice(0, 5).map(k => `"${k}"`).join(' OR ');
    } else {
      queryTerms = keywords.slice(0, 5).map(k => `"${k}"`).join(' OR ');
    }

    if (searchQuery && searchQuery.trim()) {
      queryTerms = `(${searchQuery.trim()}) AND (${queryTerms})`;
    }

    const encodedQuery = encodeURIComponent(queryTerms);
    apiUrl = `https://newsapi.org/v2/everything?q=${encodedQuery}&language=en&sortBy=publishedAt&pageSize=40&page=${page}&apiKey=${apiKey}`;
  }

  let rawData;
  try {
    rawData = await httpsGetJson(apiUrl);
  } catch (err) {
    // Fallback to top technology headlines if /everything query fails
    const fallbackUrl = `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=40&apiKey=${apiKey}`;
    try {
      rawData = await httpsGetJson(fallbackUrl);
    } catch (fallbackErr) {
      throw new Error(err.message || 'News API provider is temporarily unavailable.');
    }
  }

  if (!rawData || rawData.status !== 'ok' || !Array.isArray(rawData.articles)) {
    throw new Error(rawData.message || 'News API returned empty or malformed response.');
  }

  // Deduplicate and Validate
  const seenUrls = new Set();
  const seenTitles = new Set();
  const articles = [];

  for (const item of rawData.articles) {
    if (!item.title || item.title === '[Removed]' || !item.url) continue;

    const cleanUrl = item.url.split('?')[0].replace(/\/$/, '').toLowerCase();
    const cleanTitle = item.title.trim().toLowerCase().replace(/[^\w\s]/gi, '');

    if (seenUrls.has(cleanUrl) || seenTitles.has(cleanTitle)) continue;

    const { isValid, topic } = validateArticleRelevance(item, filterKey, keywords);
    if (!isValid) continue;

    seenUrls.add(cleanUrl);
    seenTitles.add(cleanTitle);

    articles.push({
      id: `news_${Buffer.from(cleanUrl).toString('base64').substring(0, 16)}`,
      title: item.title,
      description: item.description || 'Click Read Article to view full story from original publisher.',
      url: item.url,
      imageUrl: item.urlToImage || null,
      source: item.source ? item.source.name : 'Tech Publisher',
      publishedAt: item.publishedAt || new Date().toISOString(),
      relativeTime: formatRelativeTime(item.publishedAt),
      topic: topic || null
    });
  }

  // Sorting
  if (sort === 'latest') {
    articles.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  }

  const responseData = {
    success: true,
    filter: filterKey,
    filterDisplayName,
    source: 'newsapi',
    totalResults: articles.length,
    articles
  };

  newsCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
  return responseData;
}

module.exports = {
  fetchPersonalizedTechNews,
  normalizeFilterKey,
  FILTER_DISPLAY_NAMES
};
