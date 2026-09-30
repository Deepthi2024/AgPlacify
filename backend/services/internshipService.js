/**
 * Placify AI — Real-World Internship & Early Career Opportunities Service
 * Integrates with Adzuna Jobs API (https://api.adzuna.com)
 * Features:
 * - Domain & Roadmap personalized internship keyword queries
 * - Internship/Student/Entry-level role filtering (excluding senior/lead/manager roles)
 * - Location detection & remote filtering
 * - Deterministic relevance scoring
 * - Backend TTL caching (15 min TTL)
 */

const https = require('https');
const { normalizeDomainKey, DOMAIN_CONFIG } = require('../engine/knowledgeGraph');

// In-Memory TTL Cache
const internshipCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Domain to Internship Keyword Mapping
 */
const DOMAIN_INTERNSHIP_KEYWORDS = {
  datascience: ['Data Science Intern', 'Machine Learning Intern', 'AI Intern', 'Data Analyst Intern', 'Python Intern', 'ML Engineer Intern'],
  cybersecurity: ['Cybersecurity Intern', 'Security Analyst Intern', 'SOC Intern', 'Ethical Hacking Intern', 'Cloud Security Intern', 'Information Security Intern'],
  fullstack: ['Web Developer Intern', 'Frontend Developer Intern', 'Backend Developer Intern', 'Full Stack Developer Intern', 'React Intern', 'Node.js Intern', 'Software Engineer Intern'],
  devops: ['Cloud Engineer Intern', 'AWS Intern', 'Azure Intern', 'DevOps Intern', 'Cloud Systems Intern', 'Site Reliability Intern'],
  mobile: ['Mobile Developer Intern', 'Flutter Intern', 'Android Developer Intern', 'iOS Developer Intern', 'React Native Intern'],
  dsa: ['Software Development Engineer Intern', 'SDE Intern', 'Software Engineering Intern', 'Algorithm Engineer Intern'],
  ai_llm: ['AI Intern', 'Machine Learning Intern', 'Deep Learning Intern', 'LLM Intern', 'AI Engineer Intern', 'NLP Intern'],
  system_design: ['Software Architect Intern', 'Distributed Systems Intern', 'Backend Engineer Intern', 'System Engineer Intern']
};

/**
 * Normalizes and extracts internship keywords for any domain
 */
function getInternshipKeywordsForDomain(rawDomain) {
  const domainKey = normalizeDomainKey(rawDomain);
  if (DOMAIN_INTERNSHIP_KEYWORDS[domainKey]) {
    return DOMAIN_INTERNSHIP_KEYWORDS[domainKey];
  }
  const cleanName = String(rawDomain || '').trim();
  if (cleanName.length > 0) {
    return [`${cleanName} Intern`, `${cleanName} Developer Intern`, `${cleanName} Analyst Intern`];
  }
  return ['Software Intern', 'Developer Intern', 'Data Intern'];
}

/**
 * Helper to perform HTTPS GET requests
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
            reject(new Error('Invalid JSON received from Adzuna API provider'));
          }
        } else {
          try {
            const errJson = JSON.parse(data);
            reject(new Error(errJson.message || `Adzuna API error HTTP ${res.statusCode}`));
          } catch (e) {
            reject(new Error(`Adzuna API provider returned HTTP ${res.statusCode}`));
          }
        }
      });
    }).on('error', err => reject(err));
  });
}

/**
 * Senior role exclusion filter
 */
const SENIOR_KEYWORDS = ['senior', 'sr.', 'lead', 'manager', 'director', 'principal', 'head of', 'architect', 'vp', 'vice president', 'chief'];

function isSeniorRole(titleStr) {
  if (!titleStr) return false;
  const lower = titleStr.toLowerCase();
  return SENIOR_KEYWORDS.some(sk => lower.includes(sk));
}

/**
 * Calculates internship relevance score
 */
function calculateInternshipRelevance(job, domainKeywords, userSkills = []) {
  let score = 60;
  const titleLower = (job.title || '').toLowerCase();
  const descLower = (job.description || '').toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  if (titleLower.includes('intern') || titleLower.includes('internship') || titleLower.includes('trainee') || titleLower.includes('student')) {
    score += 25;
  }

  domainKeywords.forEach(kw => {
    const kwLower = kw.toLowerCase();
    if (combined.includes(kwLower)) score += 15;
  });

  const matchedSkills = [];
  userSkills.forEach(skill => {
    const sName = String(skill.name || skill).toLowerCase();
    if (sName && combined.includes(sName)) {
      score += 10;
      matchedSkills.push(skill.name || skill);
    }
  });

  if (job.location && (job.location.display_name || '').toLowerCase().includes('remote')) {
    score += 10;
  }

  return {
    score: Math.min(score, 100),
    matchedSkills: Array.from(new Set(matchedSkills))
  };
}

/**
 * Main Service: Fetch personalized internships from Adzuna
 */
async function fetchPersonalizedInternships({ domain, userLocation = 'India', userSkills = [], searchQuery = '', filter = 'All', page = 1 }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey || appId.trim() === '' || appKey.trim() === '') {
    throw new Error('ADZUNA_APP_ID or ADZUNA_APP_KEY is not configured in backend environment.');
  }

  const domainKey = normalizeDomainKey(domain);
  const keywords = getInternshipKeywordsForDomain(domainKey);
  const domainDisplayName = DOMAIN_CONFIG[domainKey] ? DOMAIN_CONFIG[domainKey].displayName : (domain || 'Technology');

  // Country code mapping (default 'in' for India)
  let countryCode = 'in';
  const locClean = String(userLocation || '').toLowerCase();
  if (locClean.includes('us') || locClean.includes('united states') || locClean.includes('america')) countryCode = 'us';
  else if (locClean.includes('uk') || locClean.includes('united kingdom') || locClean.includes('london')) countryCode = 'gb';
  else if (locClean.includes('ca') || locClean.includes('canada')) countryCode = 'ca';
  else if (locClean.includes('au') || locClean.includes('australia')) countryCode = 'au';

  let searchWhat = searchQuery && searchQuery.trim() ? `${searchQuery.trim()} intern` : keywords[0];
  if (filter === 'Remote') {
    searchWhat += ' remote';
  }

  const cacheKey = `internships_${domainKey}_${countryCode}_${searchWhat}_${filter}_${page}`;
  const cached = internshipCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const encodedWhat = encodeURIComponent(searchWhat);
  const apiUrl = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/${page}?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodedWhat}&content-type=application/json`;

  const rawData = await httpsGetJson(apiUrl);
  if (!rawData || !Array.isArray(rawData.results)) {
    throw new Error('Adzuna API returned malformed or empty results.');
  }

  const seenIds = new Set();
  const internships = [];

  for (const item of rawData.results) {
    if (!item.title || !item.redirect_url) continue;

    // Filter out senior/managerial roles
    if (isSeniorRole(item.title)) continue;

    const jobId = item.id || Buffer.from(item.redirect_url).toString('base64').substring(0, 16);
    if (seenIds.has(jobId)) continue;
    seenIds.add(jobId);

    const { score: relScore, matchedSkills } = calculateInternshipRelevance(item, keywords, userSkills);

    const companyName = item.company ? (item.company.display_name || 'Hiring Company') : 'Hiring Company';
    const locDisplayName = item.location ? (item.location.display_name || userLocation || 'India') : (userLocation || 'India');
    const isRemote = locDisplayName.toLowerCase().includes('remote') || (item.title || '').toLowerCase().includes('remote') || (item.description || '').toLowerCase().includes('remote');

    // Salary formatting if available
    let salaryDisplay = 'Not specified';
    if (item.salary_min || item.salary_max) {
      const minSal = item.salary_min ? Math.round(item.salary_min) : null;
      const maxSal = item.salary_max ? Math.round(item.salary_max) : null;
      if (minSal && maxSal && minSal !== maxSal) {
        salaryDisplay = `₹${minSal.toLocaleString('en-IN')} - ₹${maxSal.toLocaleString('en-IN')} / yr`;
      } else if (minSal || maxSal) {
        salaryDisplay = `₹${(minSal || maxSal).toLocaleString('en-IN')} / yr`;
      }
    }

    const matchedSkillText = matchedSkills.length > 0
      ? `Matches ${matchedSkills.slice(0, 3).join(', ')} in your roadmap.`
      : `Matches core competencies for ${domainDisplayName}.`;

    internships.push({
      id: String(jobId),
      title: item.title,
      company: companyName,
      description: item.description ? item.description.replace(/<[^>]*>?/gm, '').trim() : 'Click Apply to view complete internship description and requirements.',
      location: locDisplayName,
      remote: isRemote,
      internshipType: isRemote ? 'Remote Internship' : 'On-Site Internship',
      postedAt: item.created || new Date().toISOString(),
      deadline: 'Open Until Filled',
      url: item.redirect_url,
      source: 'Adzuna Jobs Network',
      salary: salaryDisplay,
      skills: matchedSkills.length > 0 ? matchedSkills : [keywords[0].replace(' Intern', ''), 'Problem Solving'],
      relevanceScore: relScore,
      relevanceReason: matchedSkillText
    });
  }

  // Filter options application
  let filteredList = internships;
  if (filter === 'Remote') {
    filteredList = internships.filter(i => i.remote);
  } else if (filter === 'On-site') {
    filteredList = internships.filter(i => !i.remote);
  } else if (filter === 'Latest') {
    filteredList = [...internships].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  } else if (filter === 'Most Relevant') {
    filteredList = [...internships].sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  const responseData = {
    success: true,
    domain: domainKey,
    domainDisplayName,
    location: userLocation,
    totalResults: filteredList.length,
    internships: filteredList
  };

  internshipCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
  return responseData;
}

module.exports = {
  fetchPersonalizedInternships,
  getInternshipKeywordsForDomain
};
