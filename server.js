import { createServer as createHttpServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function isWithin(parent, child) {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== '' && !isAbsolute(pathFromParent)
    && pathFromParent !== '..' && !pathFromParent.startsWith(`..${sep}`);
}

function reply(request, response, status, body, type = 'text/plain; charset=utf-8') {
  const content = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': content.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...(status === 405 ? { Allow: 'GET, HEAD' } : {}),
  });
  response.end(request.method === 'HEAD' ? undefined : content);
}

/** Static development server. Expenses remain in the browser, never on this server. */
export function createServer({ root = PROJECT_ROOT } = {}) {
  const resolvedRoot = resolve(root);
  return createHttpServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      reply(request, response, 405, 'Method not allowed.');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      reply(request, response, 400, 'Invalid request path.');
      return;
    }

    const isIndex = pathname === '/' || pathname === '/index.html';
    const isSourceAsset = pathname.startsWith('/src/')
      && MIME_TYPES.has(extname(pathname).toLowerCase());
    if ((!isIndex && !isSourceAsset)
        || pathname.includes('\\') || pathname.includes('\0')
        || pathname.split('/').includes('..')) {
      reply(request, response, 404, 'Not found.');
      return;
    }

    try {
      const requestedPath = resolve(resolvedRoot, isIndex ? 'index.html' : pathname.slice(1));
      const [actualPath, actualRoot] = await Promise.all([
        realpath(requestedPath),
        realpath(isIndex ? resolvedRoot : resolve(resolvedRoot, 'src')),
      ]);
      // Check resolved paths too, so a symlink cannot expose files outside the assets folder.
      if (!isWithin(actualRoot, actualPath)
          || (isIndex && relative(actualRoot, actualPath) !== 'index.html')) {
        reply(request, response, 404, 'Not found.');
        return;
      }
      const data = await readFile(actualPath);
      reply(request, response, 200, data, MIME_TYPES.get(extname(actualPath).toLowerCase()));
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR', 'EACCES', 'EPERM'].includes(error.code)) {
        reply(request, response, 404, 'Not found.');
      } else {
        reply(request, response, 500, 'Unable to read this file.');
      }
    }
  });
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be a whole number from 1 to 65535.');
    process.exitCode = 1;
  } else {
    const server = createServer();
    server.on('error', (error) => {
      console.error(error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Stop the other server or choose another PORT.`
        : `Unable to start the local server: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Together Expenses is ready at http://127.0.0.1:${port}`);
      console.log('Open this address in your browser. Press Ctrl+C to stop.');
      console.log('Expense data is saved in this browser profile, not on the server.');
    });
  }
}
