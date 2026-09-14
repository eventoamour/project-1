const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || /(?:^|[\\/])\./.test(pathname) || !['.html','.css','.js','.webp','.jpg','.svg'].includes(path.extname(file))) { response.writeHead(403); response.end(); return; }
  fs.readFile(file, (error, content) => {
    response.writeHead(error ? 404 : 200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream' });
    response.end(error ? 'Not found' : content);
  });
}).listen(8080, '127.0.0.1', () => console.log('Empire Group preview: http://127.0.0.1:8080'));
