/* VoicePresets — prerecorded preset voice lines played over the video plates.
 *
 * The clips live at assets/audio/presets/<charId>/presets.json (+ mp3s).
 * Playback goes through one shared Audio element layered over the current
 * video plate, so she can talk without interrupting the footage. These are
 * prerecorded preset lines chosen at random — a line played when the guest
 * types is an acknowledgment, not a live answer.
 *
 * Works as a browser global (window.VoicePresets) and as a CommonJS module
 * for tests.
 */
(function (factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    (typeof window !== 'undefined' ? window : this).VoicePresets = factory();
  }
})(function () {
  'use strict';

  function presetDir(charId) {
    return 'assets/audio/presets/' + charId;
  }

  // Pure: pick a random preset index, avoiding an immediate repeat.
  function pickIndex(count, lastIdx) {
    if (count <= 0) return -1;
    if (count === 1) return 0;
    let i = Math.floor(Math.random() * count);
    if (i === lastIdx) i = (i + 1) % count;
    return i;
  }

  // Pure: normalize a presets.json manifest into playable entries.
  function normalizeManifest(charId, manifest) {
    if (!Array.isArray(manifest)) return [];
    const dir = presetDir(charId);
    return manifest
      .filter(function (e) { return e && e.file; })
      .map(function (e) {
        return { id: e.id, text: e.text || '', url: dir + '/' + e.file };
      });
  }

  // Pure: randomized gap delay in ms between minMs and maxMs.
  function nextGapDelay(minMs, maxMs) {
    return minMs + Math.random() * (maxMs - minMs);
  }

  // Player: owns one Audio element and never talks over itself.
  // Touching the DOM only happens when its methods are called, so the pure
  // helpers stay testable in Node.
  function createPlayer() {
    let audio = null;
    let unlocked = false;

    function ensureAudio() {
      if (!audio) {
        try { audio = new Audio(); } catch (_) { audio = null; }
      }
      return audio;
    }

    return {
      // Call from a real user gesture so later autoplay isn't blocked.
      unlock: function () {
        if (unlocked) return;
        const a = ensureAudio();
        if (a) { try { a.muted = false; } catch (_) {} }
        unlocked = true;
      },
      isPlaying: function () {
        const a = ensureAudio();
        return !!(a && !a.paused && !a.ended);
      },
      play: function (url) {
        const a = ensureAudio();
        if (!a || !a.paused) return false;
        try {
          a.src = url;
          const p = a.play();
          if (p && typeof p.catch === 'function') p.catch(function () {});
          return true;
        } catch (_) {
          return false;
        }
      },
      stop: function () {
        const a = ensureAudio();
        if (a && !a.paused) { try { a.pause(); } catch (_) {} }
      }
    };
  }

  return {
    presetDir: presetDir,
    pickIndex: pickIndex,
    normalizeManifest: normalizeManifest,
    nextGapDelay: nextGapDelay,
    createPlayer: createPlayer
  };
});
