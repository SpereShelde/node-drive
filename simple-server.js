const http = require('http');
const querystring = require('querystring');

http.createServer(function (req, res) {
  const { url } = req;
  const index = url.indexOf('code');
  setTimeout(() => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('end');
  }, 5000)
  // if (index === -1) {
  //   res.writeHead(200, {'Content-Type': 'text/html'});
  //   res.end('NULL');
  // } else {
  //   res.writeHead(200, {'Content-Type': 'text/html'});
  //   res.end(querystring.parse(url.substr(url.indexOf('?') + 1)).code);
  // }
}).listen(8080);