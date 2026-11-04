// Localwomen — a tiny, zero-dependency web HTTP client (Postman-lite).
// Run: node server.js   then open http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
// Bound to localhost by default: this server forwards arbitrary requests,
// so exposing it on a network would make it an open proxy.
const HOST = process.env.HOST || '127.0.0.1';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 30000;
const INDEX = path.join(__dirname, 'public', 'index.html');

// Hop-by-hop headers that fetch() rejects or that make no sense to forward.
const BLOCKED = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'expect', 'te', 'trailer']);

function sendJson(res, status, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function proxy(req, res) {
  let spec;
  try {
    spec = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: 'Invalid proxy payload: ' + e.message });
  }

  const method = String(spec.method || 'GET').toUpperCase();
  let url;
  try {
    url = new URL(spec.url);
    if (!/^https?:$/.test(url.protocol)) throw new Error('Only http and https URLs are supported');
  } catch (e) {
    return sendJson(res, 400, { error: 'Invalid URL: ' + e.message });
  }

  const headers = {};
  for (const [k, v] of Object.entries(spec.headers || {})) {
    const key = k.trim();
    if (!key || BLOCKED.has(key.toLowerCase())) continue;
    headers[key] = String(v);
  }

  let body = spec.body != null && spec.body !== '' && method !== 'GET' && method !== 'HEAD' ? spec.body : undefined;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const started = performance.now();
  try {
    // Follow redirects by hand so cookies set on a redirect (e.g. login → 302 → dashboard)
    // are captured and sent on to the next hop, the way a browser does.
    let cur = url, curMethod = method, r;
    const setCookies = [];   // [{ url, cookie }] from every hop, for the client's cookie jar
    const redirects = [];
    for (let hop = 0; ; hop++) {
      r = await fetch(cur, { method: curMethod, headers, body, redirect: 'manual', signal });
      for (const c of r.headers.getSetCookie()) setCookies.push({ url: cur.href, cookie: c });
      const loc = r.headers.get('location');
      if (!loc || r.status < 300 || r.status > 399 || r.status === 304 || spec.followRedirects === false) break;
      if (hop >= 10) throw new Error('Too many redirects (more than 10)');
      await r.arrayBuffer();
      const next = new URL(loc, cur);
      redirects.push({ status: r.status, from: cur.href, to: next.href });
      if (r.status === 303 || ((r.status === 301 || r.status === 302) && curMethod === 'POST')) {
        if (curMethod !== 'HEAD') curMethod = 'GET';
        body = undefined;
        for (const k of Object.keys(headers)) if (k.toLowerCase() === 'content-type') delete headers[k];
      }
      if (next.host !== cur.host) {
        // Don't leak credentials to another host.
        for (const k of Object.keys(headers)) if (/^(authorization|cookie)$/i.test(k)) delete headers[k];
      }
      // Merge cookies set by this hop for the same host into the Cookie header of the next hop.
      const fresh = setCookies.filter((s) => new URL(s.url).host === next.host).map((s) => s.cookie.split(';')[0].trim()).filter((p) => p.includes('='));
      if (fresh.length) {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === 'cookie') || 'Cookie';
        const jar = new Map((headers[key] || '').split(';').map((p) => p.trim()).filter(Boolean).map((p) => [p.split('=')[0], p]));
        for (const p of fresh) jar.set(p.split('=')[0], p);
        headers[key] = [...jar.values()].join('; ');
      }
      cur = next;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const elapsed = Math.round(performance.now() - started);
    const respHeaders = [];
    r.headers.forEach((value, key) => { if (key !== 'set-cookie') respHeaders.push([key, value]); });
    const finalCookies = r.headers.getSetCookie();
    for (const c of finalCookies) respHeaders.push(['set-cookie', c]);
    sendJson(res, 200, {
      status: r.status,
      statusText: r.statusText,
      url: cur.href,
      redirected: redirects.length > 0,
      redirects,
      timeMs: elapsed,
      size: buf.length,
      headers: respHeaders,
      cookies: finalCookies,
      setCookies,
      body: buf.toString('utf8'),
    });
  } catch (e) {
    const cause = e.cause ? ` (${e.cause.code || e.cause.message})` : '';
    const msg = e.name === 'TimeoutError' ? `Request timed out after ${TIMEOUT_MS} ms` : e.message + cause;
    sendJson(res, 502, { error: msg, timeMs: Math.round(performance.now() - started) });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/send') return proxy(req, res);
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return fs.readFile(INDEX, (err, data) => {
      if (err) { res.writeHead(500); return res.end('index.html missing'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => console.log(`Localwomen running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
