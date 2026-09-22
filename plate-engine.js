/*
 * Keyhole Plate Engine
 *
 * Plate-first webcam playback for a character session.
 *
 *   1. Folder first  — a character has a plate folder per beat (idle, tease, give, stop,
 *                      presence). A beat with no file is OFF; the engine never invents it live.
 *   2. Plate rule    — default action is "play a plate". Generate only when the specific plate
 *                      requested (beat + variant) does not exist yet. Generated output is saved
 *                      into the folder and is a plate from then on.
 *   3. Hard caps     — new cuts per session: 15 min → 2, 30 → 3, 45 → 4, <60 → 5, 60 → 6, 75 → 6.
 *                      At the cap the engine is plates-only, regardless of what is asked.
 *   4. No repeats    — the same file never plays twice in a row (idle loop excepted);
 *                      the same give file never plays twice inside two minutes.
 *   5. Log           — every decision is logged; shuffleReport() flags any file that played
 *                      3+ times within a minute; stats() gives plate vs generator ratio.
 *
 * Works as a browser global (window.KeyholePlateEngine) and as a CommonJS module for tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KeyholePlateEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BEATS = ['idle', 'tease', 'give', 'stop', 'presence'];
  const REQUIRED_CHARACTERS = ['chloe', 'bailey'];
  const GIVE_COOLDOWN_MS = 2 * 60 * 1000;
  const SHUFFLE_WINDOW_MS = 60 * 1000;
  const SHUFFLE_THRESHOLD = 3;
  const LOG_LIMIT = 5000;
  const TARGET_PLATE_RATIO = 0.9;
  const COST_CHECK_SESSIONS = 20;

  const LIBRARY_KEY = 'keyhole_plate_library_v1';
  const LOG_KEY = 'keyhole_plate_log_v1';

  function capForMinutes(minutes) {
    const m = Number(minutes) || 0;
    if (m <= 15) return 2;
    if (m <= 30) return 3;
    if (m <= 45) return 4;
    if (m < 60) return 5;
    return 6;
  }

  function emptyFolder() {
    const f = {};
    BEATS.forEach(b => { f[b] = []; });
    return f;
  }

  function normalizeFile(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return { url: entry, variant: '', generated: false };
    if (!entry.url) return null;
    return {
      url: String(entry.url),
      variant: entry.variant ? String(entry.variant) : '',
      generated: !!entry.generated,
      durationSec: Number(entry.durationSec) || 0,
      savedAt: entry.savedAt || null
    };
  }

  function normalizeManifest(manifest) {
    const out = {};
    const chars = (manifest && manifest.characters) || {};
    Object.keys(chars).forEach(charId => {
      const folder = emptyFolder();
      const src = chars[charId] || {};
      BEATS.forEach(beat => {
        (src[beat] || []).map(normalizeFile).filter(Boolean).forEach(f => folder[beat].push(f));
      });
      out[charId] = folder;
    });
    return out;
  }

  function memoryStorage() {
    const data = {};
    return {
      getItem: k => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: k => { delete data[k]; }
    };
  }

  function readJSON(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or unavailable */ }
  }

  /**
   * PlateLibrary — the plate folders. Shipped plates come from the manifest
   * (assets/plates/manifest.json); saved (generated or imported) plates are persisted in storage
   * and merged on load so they are plates on the next session.
   */
  function PlateLibrary(opts) {
    opts = opts || {};
    this.storage = opts.storage || memoryStorage();
    this.shipped = normalizeManifest(opts.manifest || {});
    this.saved = readJSON(this.storage, LIBRARY_KEY, {});
  }

  PlateLibrary.prototype.folder = function (charId) {
    const folder = emptyFolder();
    const shipped = this.shipped[charId] || emptyFolder();
    const saved = this.saved[charId] || {};
    BEATS.forEach(beat => {
      const seen = new Set();
      (shipped[beat] || []).concat((saved[beat] || []).map(normalizeFile).filter(Boolean)).forEach(f => {
        if (!seen.has(f.url)) { seen.add(f.url); folder[beat].push(f); }
      });
    });
    return folder;
  };

  PlateLibrary.prototype.files = function (charId, beat) {
    return this.folder(charId)[beat] || [];
  };

  PlateLibrary.prototype.beatEnabled = function (charId, beat) {
    return this.files(charId, beat).length > 0;
  };

  PlateLibrary.prototype.hasPlate = function (charId, beat, variant) {
    return this.files(charId, beat).some(f => f.variant === (variant || ''));
  };

  PlateLibrary.prototype.save = function (charId, beat, file) {
    const f = normalizeFile(file);
    if (!f || BEATS.indexOf(beat) === -1) return null;
    f.savedAt = f.savedAt || new Date().toISOString();
    if (!this.saved[charId]) this.saved[charId] = {};
    if (!this.saved[charId][beat]) this.saved[charId][beat] = [];
    if (!this.saved[charId][beat].some(x => x.url === f.url)) this.saved[charId][beat].push(f);
    writeJSON(this.storage, LIBRARY_KEY, this.saved);
    return f;
  };

  PlateLibrary.prototype.characters = function () {
    const ids = new Set(Object.keys(this.shipped).concat(Object.keys(this.saved)));
    REQUIRED_CHARACTERS.forEach(c => ids.add(c));
    return Array.from(ids);
  };

  /** Readiness: a character can take a paid show only when every beat folder has a file. */
  PlateLibrary.prototype.readiness = function (charId) {
    const folder = this.folder(charId);
    const beats = {};
    const missing = [];
    BEATS.forEach(beat => {
      beats[beat] = { files: folder[beat].length, enabled: folder[beat].length > 0 };
      if (folder[beat].length === 0) missing.push(beat);
    });
    return { character: charId, ready: missing.length === 0, beats, missing };
  };

  PlateLibrary.prototype.showReady = function () {
    const report = {};
    let ready = true;
    REQUIRED_CHARACTERS.forEach(c => {
      report[c] = this.readiness(c);
      if (!report[c].ready) ready = false;
    });
    return { ready, characters: report };
  };

  /**
   * PlayLog — append-only decision log shared across sessions (persisted).
   */
  function PlayLog(opts) {
    opts = opts || {};
    this.storage = opts.storage || memoryStorage();
    this.entries = readJSON(this.storage, LOG_KEY, []);
  }

  PlayLog.prototype.append = function (entry) {
    this.entries.push(entry);
    if (this.entries.length > LOG_LIMIT) this.entries = this.entries.slice(-LOG_LIMIT);
    writeJSON(this.storage, LOG_KEY, this.entries);
    return entry;
  };

  PlayLog.prototype.recent = function (n) {
    return this.entries.slice(-(n || 50)).reverse();
  };

  PlayLog.prototype.clear = function () {
    this.entries = [];
    writeJSON(this.storage, LOG_KEY, this.entries);
  };

  /** Any file that played SHUFFLE_THRESHOLD+ times inside a one-minute window means the shuffle is broken. */
  PlayLog.prototype.shuffleReport = function (opts) {
    opts = opts || {};
    const windowMs = opts.windowMs || SHUFFLE_WINDOW_MS;
    const threshold = opts.threshold || SHUFFLE_THRESHOLD;
    const plays = this.entries.filter(e => e.url && (e.action === 'plate' || e.action === 'generated'));
    const byUrl = {};
    plays.forEach(e => { (byUrl[e.url] = byUrl[e.url] || []).push(e.t); });
    const violations = [];
    Object.keys(byUrl).forEach(url => {
      const ts = byUrl[url].slice().sort((a, b) => a - b);
      for (let i = 0; i + threshold - 1 < ts.length; i++) {
        if (ts[i + threshold - 1] - ts[i] <= windowMs) {
          violations.push({ url, count: threshold, windowStart: ts[i], windowEnd: ts[i + threshold - 1] });
          break;
        }
      }
    });
    return { ok: violations.length === 0, violations, playsChecked: plays.length };
  };

  /** Plate plays vs generator use. After 20 real sessions, 90%+ plates is the bar. */
  PlayLog.prototype.stats = function () {
    let platePlays = 0, generatedPlays = 0, generatorSeconds = 0, withheld = 0, off = 0;
    const sessions = new Set();
    this.entries.forEach(e => {
      if (e.sessionId) sessions.add(e.sessionId);
      if (e.action === 'plate') platePlays++;
      else if (e.action === 'generated') { generatedPlays++; generatorSeconds += Number(e.durationSec) || 0; }
      else if (e.action === 'withhold') withheld++;
      else if (e.action === 'off') off++;
    });
    const total = platePlays + generatedPlays;
    const plateRatio = total ? platePlays / total : 1;
    return {
      sessions: sessions.size,
      platePlays,
      generatedPlays,
      generatorMinutes: Math.round(generatorSeconds / 60 * 100) / 100,
      withheld,
      off,
      plateRatio,
      platePercent: Math.round(plateRatio * 1000) / 10,
      costCheckDue: sessions.size >= COST_CHECK_SESSIONS,
      costCheckPass: sessions.size < COST_CHECK_SESSIONS ? null : plateRatio >= TARGET_PLATE_RATIO,
      targetPlateRatio: TARGET_PLATE_RATIO
    };
  };

  /**
   * PlateEngine — one per live session.
   *
   * opts: { character, sessionMinutes, library, log, generator, now, random, sessionId }
   *   generator(request) → Promise<{url, durationSec}> | {url, durationSec}; optional.
   */
  function PlateEngine(opts) {
    opts = opts || {};
    this.character = opts.character || 'chloe';
    this.sessionMinutes = opts.sessionMinutes || 15;
    this.cap = capForMinutes(this.sessionMinutes);
    this.library = opts.library || new PlateLibrary({ manifest: opts.manifest, storage: opts.storage });
    this.log = opts.log || new PlayLog({ storage: opts.storage });
    this.generator = opts.generator || null;
    this.now = opts.now || (() => Date.now());
    this.random = opts.random || Math.random;
    this.sessionId = opts.sessionId || ('s_' + this.now() + '_' + Math.floor(this.random() * 1e6));
    this.generatedCount = 0;
    this.lastUrl = null;
    this.lastGiveByUrl = {};
    this.lastPlayedAt = {};
    this.history = [];
  }

  PlateEngine.prototype.capReached = function () {
    return this.generatedCount >= this.cap;
  };

  PlateEngine.prototype.generationsLeft = function () {
    return Math.max(0, this.cap - this.generatedCount);
  };

  PlateEngine.prototype._record = function (entry) {
    entry.t = this.now();
    entry.character = this.character;
    entry.sessionId = this.sessionId;
    entry.sessionMinutes = this.sessionMinutes;
    entry.generatedCount = this.generatedCount;
    entry.cap = this.cap;
    this.history.push(entry);
    this.log.append(entry);
    if (entry.url && (entry.action === 'plate' || entry.action === 'generated')) {
      this.lastUrl = entry.url;
      this.lastPlayedAt[entry.url] = entry.t;
      if (entry.beat === 'give') this.lastGiveByUrl[entry.url] = entry.t;
    }
    return entry;
  };

  PlateEngine.prototype._eligible = function (beat) {
    const now = this.now();
    let files = this.library.files(this.character, beat);
    if (beat !== 'idle') files = files.filter(f => f.url !== this.lastUrl);
    if (beat === 'give') {
      files = files.filter(f => {
        const last = this.lastGiveByUrl[f.url];
        return !last || now - last >= GIVE_COOLDOWN_MS;
      });
    }
    return files;
  };

  /** Random among files not played in the last minute; otherwise the least recently played. */
  PlateEngine.prototype._pick = function (files) {
    const now = this.now();
    const fresh = files.filter(f => !(f.url in this.lastPlayedAt) || now - this.lastPlayedAt[f.url] >= SHUFFLE_WINDOW_MS);
    if (fresh.length) return fresh[Math.floor(this.random() * fresh.length) % fresh.length];
    return files.slice().sort((a, b) => (this.lastPlayedAt[a.url] || 0) - (this.lastPlayedAt[b.url] || 0))[0];
  };

  /**
   * Decide what to play for a beat.
   * request: { variant, prompt } — variant names a specific cut; generation happens only when
   *          the beat is enabled, no plate with that variant exists, and the cap is not reached.
   * Returns { action: 'plate' | 'generated' | 'withhold' | 'off', beat, url?, reason }.
   */
  PlateEngine.prototype.next = async function (beat, request) {
    request = request || {};
    if (BEATS.indexOf(beat) === -1) {
      return this._record({ action: 'off', beat, reason: 'unknown_beat' });
    }
    if (!this.library.beatEnabled(this.character, beat)) {
      return this._record({ action: 'off', beat, reason: 'beat_has_no_file' });
    }

    const variant = request.variant || '';
    const wantsNewCut = !!variant && !this.library.hasPlate(this.character, beat, variant);

    if (wantsNewCut && !this.capReached() && this.generator) {
      try {
        const result = await this.generator({ character: this.character, beat, variant, prompt: request.prompt || '' });
        if (result && result.url) {
          this.generatedCount++;
          const saved = this.library.save(this.character, beat, {
            url: result.url, variant, generated: true, durationSec: result.durationSec || 0
          });
          return this._record({
            action: 'generated', beat, url: saved.url, variant,
            durationSec: saved.durationSec, reason: 'plate_missing_generated_and_saved'
          });
        }
      } catch (e) {
        this._record({ action: 'generate_failed', beat, variant, reason: String(e && e.message || e) });
      }
    }

    const eligible = this._eligible(beat);
    if (eligible.length === 0) {
      const reason = beat === 'give' ? 'give_cooldown_or_repeat' : 'no_repeat_available';
      return this._record({ action: 'withhold', beat, reason });
    }

    const chosen = this._pick(eligible);
    const reason = wantsNewCut
      ? (this.capReached() ? 'cap_reached_plates_only' : 'generator_unavailable_plates_only')
      : 'plate';
    return this._record({ action: 'plate', beat, url: chosen.url, variant: chosen.variant, durationSec: chosen.durationSec, reason });
  };

  return {
    BEATS,
    REQUIRED_CHARACTERS,
    GIVE_COOLDOWN_MS,
    SHUFFLE_WINDOW_MS,
    SHUFFLE_THRESHOLD,
    TARGET_PLATE_RATIO,
    COST_CHECK_SESSIONS,
    LIBRARY_KEY,
    LOG_KEY,
    capForMinutes,
    memoryStorage,
    PlateLibrary,
    PlayLog,
    PlateEngine
  };
});
