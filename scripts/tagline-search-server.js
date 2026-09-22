#!/usr/bin/env node
/**
 * Local / Railway sidecar for Tagline Scout.
 * Serves POST /.netlify/functions/tagline-search (and POST /) using the same
 * handler as the Netlify function.
 *
 * Local:  node scripts/tagline-search-server.js
 *         (or: npx netlify functions:serve — if Netlify CLI is installed)
 * Docker: started beside nginx; listens on 127.0.0.1:3456
 */
'use strict';

const http = require('http');
const path = require('path');
const { handleRequest } = require('../netlify/functions/tagline-search.js');

const PORT = Number(process.env.TAGLINE_SCOUT_PORT || 3456);
const HOST = process.env.TAGLINE_SCOUT_HOST || '127.0.0.1';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 256 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : '';
    const event = {
      httpMethod: req.method,
      path: req.url,
      headers: req.headers,
      body,
      isBase64Encoded: false,
    };
    const out = await handleRequest(event);
    const headers = out.headers || { 'Content-Type': 'application/json' };
    res.writeHead(out.statusCode || 200, headers);
    res.end(out.body || '');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Tagline Scout sidecar listening on http://${HOST}:${PORT}`);
  console.log('POST /.netlify/functions/tagline-search  { query?, urls: string[] }');
});
