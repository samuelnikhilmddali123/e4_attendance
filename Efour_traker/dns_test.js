const dns = require('dns');
dns.resolve('google.com', (err, addresses) => {
  if (err) console.error('DNS Error (google.com):', err);
  else console.log('Addresses (google.com):', addresses);
});
dns.resolveSrv('_mongodb._tcp.cluster0.pgh80.mongodb.net', (err, addresses) => {
  if (err) console.error('SRV Error:', err);
  else console.log('SRV Addresses:', addresses);
});
