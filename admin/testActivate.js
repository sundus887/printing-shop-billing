const http = require('http');

const license = {
  shopName: "saim",
  machineId: "4c04efefbabf098cec3a99ad8584a3babae86994e9a3fa81df4bbffef075dbfa",
  validTill: "2026-06-22T18:59:59.999Z",
  planMonths: 1,
  signature: "XqVc7yAb2kRyspBu+thKQigFwbMUNlI1NGxcxLhDhrVpPS1aroElB+ERB0Iv369ryHsFj/gGjHbMbSFaZtxQIwMLqHxazP4Zp0AF6PgKwZYOeU8HJ8HdmeQAUX/gnE79MfH4w1nHtCGKIJjUaCiCgfrhr2UzRCeBWrrDymFfvEZIY8kovhFhD+UF/0xmKRjd4pJZCmezjX+sovYhXsNovLXkaaL6DO4bvCtKMlKXJtev+6ripH40brXQjzQRGv47dQnUAZxVDJamPrPcIvejndeoIqiKj5L51E8y8qd0nKGUarXPHe3ULOCs7IjDwtWa2oJFIJxMQuuqQZLQkncj2t1k++nZLymnF7k6cKOp66l5PbtBxMyTT+gAi6DcwLGa+QLMM0mvh4NwAwtpXftJXbMKYwkOXwEBThYSLU9nnbLvNzxXcPrCARoU+jULhMW7ADsarEJA+csny1bucCX/efPoCWWRQhHAcfzSLtdwqBnf/d0sKUcdA5eZekNIa7tGAptCqPCZBa0T78Ah4z77BJaxJ0SqDn9U+Aho51BOR8knSdRznTkXo3QX/McxSuPYT9JqQkuHXH6priPv2QSLOqKjacB6ydatG7tZdbu86KvprFjCjDQHtfvAvKkNK5NL9a0HJ/a4x2BYwiyRfsXMTHy7esOFUet0F+orCI0U8EI="
};

const body = JSON.stringify({ license });

console.log('Sending request...');
console.log('Signature length:', license.signature.length);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/license/activate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();