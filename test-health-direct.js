const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/system/health/products',
  method: 'GET'
};

console.log('Testing health check endpoint...\n');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  console.log('\nResponse Body:');
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json, null, 2));
        console.log('\n✅ Health check successful!');
      } catch (e) {
        console.log(data);
      }
    } else {
      console.log(data.substring(0, 500));
      console.log('\n⚠️  Endpoint returned', res.statusCode);
      if (res.statusCode === 404) {
        console.log('   Next.js may need to detect the new route.');
        console.log('   Try restarting your dev server.');
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  console.log('\n⚠️  Make sure your dev server is running on port 3000');
});

req.end();
