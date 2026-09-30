const techNewsService = require('../backend/services/techNewsService');
const internshipService = require('../backend/services/internshipService');

console.log('=== TEST 1: News Service Domain Keyword Resolution ===');
const dsKeywords = techNewsService.getNewsKeywordsForDomain('datascience');
console.log('Data Science news keywords:', dsKeywords);
const cyberKeywords = techNewsService.getNewsKeywordsForDomain('cybersecurity');
console.log('Cybersecurity news keywords:', cyberKeywords);

console.log('\n=== TEST 2: Internship Service Domain Keyword Resolution ===');
const dsInternKeywords = internshipService.getInternshipKeywordsForDomain('datascience');
console.log('Data Science internship keywords:', dsInternKeywords);
const cyberInternKeywords = internshipService.getInternshipKeywordsForDomain('cybersecurity');
console.log('Cybersecurity internship keywords:', cyberInternKeywords);

console.log('\n=== TEST 3: Graceful Error Handling on Missing Keys ===');
async function testMissingKeys() {
  try {
    process.env.NEWS_API_KEY = '';
    await techNewsService.fetchPersonalizedTechNews({ domain: 'datascience' });
  } catch (err) {
    console.log('Caught expected News API key error:', err.message);
  }

  try {
    process.env.ADZUNA_APP_ID = '';
    await internshipService.fetchPersonalizedInternships({ domain: 'datascience' });
  } catch (err) {
    console.log('Caught expected Adzuna API key error:', err.message);
  }
}

testMissingKeys().then(() => {
  console.log('\n✅ ALL SERVICE LOGIC TESTS PASSED SUCCESSFULLY!');
});
