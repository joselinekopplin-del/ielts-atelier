'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4'
};

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function createServer(directory = __dirname) {
  const rootPromise = fs.realpath(directory);
  return http.createServer(async (req, res) => {
    const fail = (status, text) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : text);
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return fail(405, 'Method not allowed');
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/\\/g, '/');
    } catch { return fail(400, 'Invalid URL'); }
    if (pathname.includes('\0') || pathname.split('/').some(segment => segment.startsWith('.'))) return fail(403, 'Forbidden');
    try {
      const root = await rootPromise;
      const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!inside(root, target)) return fail(403, 'Forbidden');
      const realTarget = await fs.realpath(target);
      if (!inside(root, realTarget)) return fail(403, 'Forbidden');
      const stats = await fs.stat(realTarget);
      if (!stats.isFile()) return fail(404, 'Not found');
      const body = req.method === 'HEAD' ? undefined : await fs.readFile(realTarget);
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(realTarget).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(body);
    } catch (error) {
      fail(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500,
        error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Not found' : 'Unable to serve file');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  createServer().listen(port, '127.0.0.1', () => {
    process.stdout.write(`IELTS Atelier: http://127.0.0.1:${port}\nPress Ctrl+C to stop.\n`);
  });
}

module.exports = { createServer };
