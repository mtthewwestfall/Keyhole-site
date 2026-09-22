#!/usr/bin/env node
/**
 * Smoke-test Tagline Scout core against public cam-platform marketing pages.
 * Usage: node tests/smoke-tagline-search.js
 */
'use strict';

const { searchTaglines } = require('../netlify/functions/tagline-search.js');

const URLS = [
  'https://chaturbate.com',
  'https://www.flirt4free.com',
  'https://stripchat.com',
  'https://bongacams.com',
  'https://www.camsoda.com',
  'https://www.livejasmin.com',
];

(async () => {
  console.log('Tagline Scout smoke test — fetching', URLS.length, 'URLs…');
  const data = await searchTaglines({ query: '', urls: URLS });
  console.log(JSON.stringify({
    ok: data.ok,
    resultCount: data.resultCount,
    failureCount: (data.failures || []).length,
    top: (data.results || []).slice(0, 8).map((r) => ({
      reason: r.reason,
      score: r.score,
      text: r.text.slice(0, 100),
      sourceUrl: r.sourceUrl,
    })),
    failures: data.failures,
  }, null, 2));

  const usable = new Set((data.results || []).map((r) => {
    try { return new URL(r.sourceUrl).hostname.replace(/^www\./, ''); }
    catch { return r.sourceUrl; }
  }));
  const failedHosts = (data.failures || []).map((f) => {
    try { return new URL(f.url).hostname.replace(/^www\./, ''); }
    catch { return f.url; }
  });

  console.log('\nHosts with candidates:', [...usable].join(', ') || '(none)');
  console.log('Hosts that failed:', failedHosts.join(', ') || '(none)');

  // Required defaults must either return candidates OR at least be attempted
  const required = ['chaturbate.com', 'flirt4free.com'];
  const attempted = new Set([
    ...[...usable],
    ...failedHosts,
  ]);
  for (const host of required) {
    if (![...attempted].some((h) => h.includes(host.replace(/^www\./, '')))) {
      console.error('FAIL: required host never attempted:', host);
      process.exit(1);
    }
  }

  if (!data.ok) {
    console.error('FAIL: search returned ok:false', data.error);
    process.exit(1);
  }

  // Pass if we got any candidates from any page, or honest per-URL failures for all
  if (data.resultCount === 0 && (data.failures || []).length === 0) {
    console.error('FAIL: no results and no failures');
    process.exit(1);
  }

  console.log('\nSMOKE OK');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
