import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);

const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (request.method !== 'GET') return json(response, 405, { message: 'Method not allowed' });

  const relativePath = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1);
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404);
    return response.end('Not found');
  }
  response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, () => console.log(`KasFlow berjalan di http://localhost:${port}`));