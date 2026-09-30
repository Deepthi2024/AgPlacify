const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, error: e.message });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- TEST 1: Default All Tech News (General Tech Headlines) ---');
  try {
    const res1 = await fetchJson('http://localhost:5000/api/tech-news?domain=all');
    console.log('Status:', res1.status);
    console.log('Success:', res1.data?.success);
    console.log('Filter:', res1.data?.filter);
    console.log('Filter Display Name:', res1.data?.filterDisplayName);
    console.log('Articles count:', res1.data?.articles?.length);
    if (res1.data?.articles?.length > 0) {
      console.log('Sample Article:', {
        title: res1.data.articles[0].title,
        source: res1.data.articles[0].source,
        relativeTime: res1.data.articles[0].relativeTime,
        topic: res1.data.articles[0].topic
      });
    }
  } catch (e) {
    console.error('Test 1 failed:', e.message);
  }

  console.log('\n--- TEST 2: Tech News (Cybersecurity Filter) ---');
  try {
    const res2 = await fetchJson('http://localhost:5000/api/tech-news?domain=cybersecurity');
    console.log('Status:', res2.status);
    console.log('Filter:', res2.data?.filter);
    console.log('Articles count:', res2.data?.articles?.length);
    if (res2.data?.articles?.length > 0) {
      console.log('Top Cybersecurity Article:', {
        title: res2.data.articles[0].title,
        topic: res2.data.articles[0].topic,
        relativeTime: res2.data.articles[0].relativeTime
      });
    }
  } catch (e) {
    console.error('Test 2 failed:', e.message);
  }

  console.log('\n--- TEST 3: Tech News (Artificial Intelligence Filter) ---');
  try {
    const res3 = await fetchJson('http://localhost:5000/api/tech-news?domain=ai');
    console.log('Status:', res3.status);
    console.log('Filter:', res3.data?.filter);
    console.log('Articles count:', res3.data?.articles?.length);
    if (res3.data?.articles?.length > 0) {
      console.log('Top AI Article:', {
        title: res3.data.articles[0].title,
        topic: res3.data.articles[0].topic
      });
    }
  } catch (e) {
    console.error('Test 3 failed:', e.message);
  }

  console.log('\n--- TEST 4: Tech News (Full-Stack Web Development Filter) ---');
  try {
    const res4 = await fetchJson('http://localhost:5000/api/tech-news?domain=full-stack');
    console.log('Status:', res4.status);
    console.log('Filter:', res4.data?.filter);
    console.log('Articles count:', res4.data?.articles?.length);
    if (res4.data?.articles?.length > 0) {
      console.log('Top Full-Stack Article:', {
        title: res4.data.articles[0].title,
        topic: res4.data.articles[0].topic
      });
    }
  } catch (e) {
    console.error('Test 4 failed:', e.message);
  }
}

runTests();
