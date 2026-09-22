/**
 * Tagline Scout — server-side fetch + parse for admin.html
 * Netlify: POST /.netlify/functions/tagline-search
 * Railway: same path, proxied by nginx to the Node sidecar
 *
 * Body: { query?: string, urls: string[] }
 */

'use strict';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 512 * 1024; // 512 KB
const MAX_URLS = 12;
const USER_AGENT =
  'KeyholeTaglineScout/1.0 (+https://keyhole.cam; admin research; respectful fetch)';

const REASON_WEIGHT = {
  'og:title': 95,
  'meta:og:description': 92,
  slogan: 90,
  tagline: 90,
  hero: 85,
  subtitle: 80,
  h1: 75,
  'meta:description': 70,
  title: 55,
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

function decodeEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function metaContent(html, nameOrProp) {
  const escaped = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
      'i'
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return '';
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

function extractH1s(html) {
  const out = [];
  const re = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 5) {
    const text = stripTags(m[1]);
    if (text && text.length >= 3 && text.length <= 220) out.push(text);
  }
  return out;
}

function extractClassIdMatches(html) {
  const out = [];
  const re =
    /<(p|div|span|h[1-6]|section|header)\b([^>]*?\b(?:class|id)=["'][^"']*(?:slogan|tagline|hero|subtitle)[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    const attrs = m[2] || '';
    const text = stripTags(m[3]);
    if (!text || text.length < 3 || text.length > 280) continue;
    let reason = 'hero';
    const attrLower = attrs.toLowerCase();
    if (/slogan/.test(attrLower)) reason = 'slogan';
    else if (/tagline/.test(attrLower)) reason = 'tagline';
    else if (/subtitle/.test(attrLower)) reason = 'subtitle';
    else if (/hero/.test(attrLower)) reason = 'hero';
    out.push({ text, reason });
  }
  return out;
}

function snippetAround(haystack, needle, radius = 90) {
  const h = haystack || '';
  const n = needle || '';
  const idx = h.toLowerCase().indexOf(n.toLowerCase().slice(0, 40));
  if (idx < 0) return h.slice(0, Math.min(h.length, radius * 2));
  const start = Math.max(0, idx - radius);
  const end = Math.min(h.length, idx + n.length + radius);
  let snip = h.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = '…' + snip;
  if (end < h.length) snip = snip + '…';
  return snip;
}

function scoreCandidate(text, reason, query) {
  let score = REASON_WEIGHT[reason] || 50;
  const len = text.length;
  if (len >= 20 && len <= 120) score += 12;
  else if (len >= 12 && len <= 180) score += 6;
  else if (len < 8 || len > 240) score -= 20;

  if (query) {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    if (t.includes(q)) score += 25;
    else {
      const tokens = q.split(/\s+/).filter((x) => x.length > 2);
      const hits = tokens.filter((tok) => t.includes(tok)).length;
      if (tokens.length && hits === 0) return null; // filtered out
      score += hits * 8;
    }
  }
  return score;
}

function parseHtmlForTaglines(html, sourceUrl, query) {
  const plain = stripTags(html).slice(0, 8000);
  const candidates = [];
  const push = (text, reason) => {
    const cleaned = decodeEntities(text).replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length < 3) return;
    const score = scoreCandidate(cleaned, reason, query);
    if (score == null) return;
    candidates.push({
      text: cleaned,
      sourceUrl,
      snippet: snippetAround(plain, cleaned),
      reason,
      score,
    });
  };

  const title = extractTitle(html);
  if (title) push(title, 'title');

  const metaDesc = metaContent(html, 'description');
  if (metaDesc) push(metaDesc, 'meta:description');

  const ogTitle = metaContent(html, 'og:title');
  if (ogTitle) push(ogTitle, 'og:title');

  const ogDesc = metaContent(html, 'og:description');
  if (ogDesc) push(ogDesc, 'meta:og:description');

  for (const h1 of extractH1s(html)) push(h1, 'h1');
  for (const hit of extractClassIdMatches(html)) push(hit.text, hit.reason);

  // Dedupe by lowercase text
  const seen = new Set();
  const unique = [];
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    const key = c.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return unique;
}

function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let u;
  try {
    u = new URL(s.includes('://') ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u.toString();
}

async function fetchWithLimits(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, status: res.status };
    }
    if (ctype && !ctype.includes('html') && !ctype.includes('text/plain') && !ctype.includes('xml')) {
      return { ok: false, error: `Non-HTML content-type: ${ctype}`, status: res.status };
    }
    // Read with size cap
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    let html;
    if (reader) {
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BODY_BYTES) {
          chunks.push(value);
          break;
        }
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      html = buf.slice(0, MAX_BODY_BYTES).toString('utf8');
    } else {
      const text = await res.text();
      html = text.slice(0, MAX_BODY_BYTES);
    }
    return { ok: true, html, status: res.status, finalUrl: res.url || url };
  } catch (err) {
    const msg =
      err && err.name === 'AbortError'
        ? `Timeout after ${FETCH_TIMEOUT_MS}ms`
        : (err && err.message) || String(err);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function searchTaglines({ query, urls }) {
  const q = (query || '').trim();
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) {
    return { ok: false, error: 'Provide at least one URL in urls[]', results: [], failures: [] };
  }
  if (list.length > MAX_URLS) {
    return {
      ok: false,
      error: `Too many URLs (max ${MAX_URLS})`,
      results: [],
      failures: [],
    };
  }

  const normalized = [];
  const failures = [];
  for (const raw of list) {
    const u = normalizeUrl(raw);
    if (!u) failures.push({ url: String(raw), error: 'Invalid URL' });
    else normalized.push(u);
  }

  const perUrl = await Promise.all(
    normalized.map(async (url) => {
      const fetched = await fetchWithLimits(url);
      if (!fetched.ok) {
        return { url, failure: { url, error: fetched.error, status: fetched.status } };
      }
      const candidates = parseHtmlForTaglines(fetched.html, fetched.finalUrl || url, q || null);
      return { url, candidates, failure: null };
    })
  );

  const results = [];
  for (const row of perUrl) {
    if (row.failure) failures.push(row.failure);
    else results.push(...row.candidates);
  }

  results.sort((a, b) => b.score - a.score);

  return {
    ok: true,
    query: q || null,
    resultCount: results.length,
    results: results.map(({ text, sourceUrl, snippet, reason, score }) => ({
      text,
      sourceUrl,
      snippet,
      reason,
      score,
    })),
    failures,
  };
}

async function handleRequest(event) {
  const method = (event.httpMethod || event.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (method === 'GET') {
    return json(200, {
      ok: true,
      endpoint: 'tagline-search',
      usage: 'POST { query?: string, urls: string[] }',
    });
  }
  if (method !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  let payload;
  try {
    const raw = event.body || '{}';
    payload = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
    if (event.isBase64Encoded && typeof event.body === 'string') {
      payload = JSON.parse(Buffer.from(event.body, 'base64').toString('utf8') || '{}');
    }
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const data = await searchTaglines({
    query: payload.query,
    urls: payload.urls,
  });
  return json(data.ok ? 200 : 400, data);
}

exports.handler = async (event) => handleRequest(event);
exports.searchTaglines = searchTaglines;
exports.parseHtmlForTaglines = parseHtmlForTaglines;
exports.handleRequest = handleRequest;
