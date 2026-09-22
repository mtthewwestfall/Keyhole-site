import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PE = require('./plate-engine.js');
const { PlateEngine, PlateLibrary, PlayLog, capForMinutes, memoryStorage, BEATS } = PE;

const manifest = {
  characters: {
    chloe: {
      idle: ['idle_01.mp4', 'idle_02.mp4'],
      tease: ['tease_01.mp4', 'tease_02.mp4', 'tease_03.mp4'],
      give: ['give_01.mp4', 'give_02.mp4'],
      stop: ['stop_01.mp4'],
      presence: ['presence_01.mp4']
    },
    bailey: {
      idle: ['b_idle_01.mp4'],
      tease: [],
      give: ['b_give_01.mp4'],
      stop: [],
      presence: []
    }
  }
};

function makeEngine(overrides = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: ms => { t += ms; } };
  const storage = overrides.storage || memoryStorage();
  const engine = new PlateEngine({
    character: 'chloe',
    sessionMinutes: 15,
    manifest,
    storage,
    now: clock.now,
    random: overrides.random || (() => 0),
    generator: overrides.generator,
    ...overrides
  });
  return { engine, clock, storage };
}

test('Folder first: Chloe and Bailey have a plate folder per beat and shipped manifest exists', async (t) => {
  await t.test('repo ships assets/plates/<char>/<beat> folders and manifest.json', () => {
    for (const c of ['chloe', 'bailey']) {
      for (const b of BEATS) {
        assert.ok(fs.existsSync(path.resolve('assets/plates', c, b)), `missing folder assets/plates/${c}/${b}`);
      }
    }
    const shipped = JSON.parse(fs.readFileSync(path.resolve('assets/plates/manifest.json'), 'utf8'));
    for (const c of ['chloe', 'bailey']) {
      for (const b of BEATS) assert.ok(Array.isArray(shipped.characters[c][b]), `manifest missing ${c}.${b}`);
    }
  });

  await t.test('a beat with no file is OFF and the engine will not invent it', async () => {
    const { engine } = makeEngine({ character: 'bailey', generator: async () => ({ url: 'invented.mp4' }) });
    const res = await engine.next('tease', { variant: 'wink' });
    assert.equal(res.action, 'off');
    assert.equal(res.reason, 'beat_has_no_file');
    assert.equal(engine.generatedCount, 0);
  });

  await t.test('readiness reports missing beats; show is not ready until all five beats have files', () => {
    const lib = new PlateLibrary({ manifest });
    assert.equal(lib.readiness('chloe').ready, true);
    assert.deepEqual(lib.readiness('bailey').missing, ['tease', 'stop', 'presence']);
    assert.equal(lib.showReady().ready, false);
  });
});

test('Plate rule: play a plate by default, generate only when that plate does not exist, then save it', async (t) => {
  await t.test('default action is a plate; no generator is called when the plate exists', async () => {
    let calls = 0;
    const { engine } = makeEngine({ generator: async () => { calls++; return { url: 'gen.mp4' }; } });
    const res = await engine.next('tease');
    assert.equal(res.action, 'plate');
    assert.equal(calls, 0);
  });

  await t.test('generates only for a missing variant, saves it into the folder, and replays it as a plate', async () => {
    let calls = 0;
    const storage = memoryStorage();
    const { engine } = makeEngine({ storage, generator: async () => { calls++; return { url: 'chloe_give_lace.mp4', durationSec: 8 }; } });

    const first = await engine.next('give', { variant: 'lace' });
    assert.equal(first.action, 'generated');
    assert.equal(first.url, 'chloe_give_lace.mp4');
    assert.equal(calls, 1);

    // Same request in a fresh session (fresh engine, same storage) is now a plate.
    const { engine: next } = makeEngine({ storage, generator: async () => { calls++; return { url: 'x.mp4' }; } });
    assert.ok(next.library.hasPlate('chloe', 'give', 'lace'));
    const second = await next.next('give', { variant: 'lace' });
    assert.equal(second.action, 'plate');
    assert.equal(calls, 1);
  });

  await t.test('without a generator the engine falls back to existing plates, never errors', async () => {
    const { engine } = makeEngine();
    const res = await engine.next('tease', { variant: 'never_made' });
    assert.equal(res.action, 'plate');
    assert.equal(res.reason, 'generator_unavailable_plates_only');
  });
});

test('Hard caps: new cuts per session length, plates only after the cap', async (t) => {
  await t.test('cap table', () => {
    assert.equal(capForMinutes(15), 2);
    assert.equal(capForMinutes(30), 3);
    assert.equal(capForMinutes(45), 4);
    assert.equal(capForMinutes(50), 5);
    assert.equal(capForMinutes(60), 6);
    assert.equal(capForMinutes(75), 6);
  });

  await t.test('15-minute session: third generate request is refused even when begged', async () => {
    let calls = 0;
    const { engine } = makeEngine({ generator: async ({ variant }) => { calls++; return { url: `gen_${variant}.mp4` }; } });
    const a = await engine.next('tease', { variant: 'v1' });
    const b = await engine.next('tease', { variant: 'v2' });
    const c = await engine.next('tease', { variant: 'v3', prompt: 'please please please' });
    assert.equal(a.action, 'generated');
    assert.equal(b.action, 'generated');
    assert.equal(c.action, 'plate');
    assert.equal(c.reason, 'cap_reached_plates_only');
    assert.equal(calls, 2);
    assert.equal(engine.capReached(), true);
    assert.equal(engine.generationsLeft(), 0);
  });
});

test('No exact-clip repeat', async (t) => {
  await t.test('same file cannot play twice in a row', async () => {
    const { engine } = makeEngine();
    const seen = [];
    for (let i = 0; i < 20; i++) {
      const r = await engine.next('tease');
      assert.equal(r.action, 'plate');
      seen.push(r.url);
    }
    for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], `repeat at ${i}: ${seen[i]}`);
  });

  await t.test('a beat with one file (not idle) withholds rather than repeating back-to-back', async () => {
    const { engine } = makeEngine();
    const a = await engine.next('stop');
    const b = await engine.next('stop');
    assert.equal(a.action, 'plate');
    assert.equal(b.action, 'withhold');
  });

  await t.test('same give cannot play twice within two minutes', async () => {
    const { engine, clock } = makeEngine();
    const a = await engine.next('give');
    const b = await engine.next('give');
    assert.equal(a.action, 'plate');
    assert.equal(b.action, 'plate');
    assert.notEqual(a.url, b.url);
    const c = await engine.next('give');
    assert.equal(c.action, 'withhold', 'both give files played inside 2 min → withhold');
    clock.advance(2 * 60 * 1000);
    const d = await engine.next('give');
    assert.equal(d.action, 'plate');
    assert.notEqual(d.url, b.url, 'still no back-to-back repeat after cooldown');
  });
});

test('Log, shuffle check and cost check', async (t) => {
  await t.test('every decision is logged with session id, beat, action, url', async () => {
    const { engine } = makeEngine();
    await engine.next('idle');
    await engine.next('tease');
    const recent = engine.log.recent(10);
    assert.equal(recent.length, 2);
    assert.ok(recent.every(e => e.sessionId === engine.sessionId && e.beat && e.action && e.t));
  });

  await t.test('shuffleReport flags a file played 3 times within a minute', () => {
    const log = new PlayLog();
    [0, 10_000, 20_000].forEach(dt => log.append({ t: 1_000 + dt, action: 'plate', beat: 'give', url: 'plate_07.mp4', sessionId: 's1' }));
    const bad = log.shuffleReport();
    assert.equal(bad.ok, false);
    assert.equal(bad.violations[0].url, 'plate_07.mp4');

    const good = new PlayLog();
    [0, 30_000, 61_000].forEach(dt => good.append({ t: 1_000 + dt, action: 'plate', beat: 'give', url: 'plate_07.mp4', sessionId: 's1' }));
    assert.equal(good.shuffleReport().ok, true);
  });

  await t.test('engine output never trips the shuffle check with a 3-file beat', async () => {
    const { engine, clock } = makeEngine({ random: Math.random });
    for (let i = 0; i < 60; i++) { await engine.next('tease'); clock.advance(25_000); }
    assert.equal(engine.log.shuffleReport().ok, true);
  });

  await t.test('stats: plate ratio, generator minutes, cost check only after 20 sessions', async () => {
    const storage = memoryStorage();
    for (let s = 0; s < 20; s++) {
      const { engine } = makeEngine({ storage, sessionId: `s${s}`, generator: async () => ({ url: `g${s}.mp4`, durationSec: 60 }) });
      for (let i = 0; i < 9; i++) await engine.next('tease');
      await engine.next('tease', { variant: `only_${s}` });
    }
    const stats = new PlayLog({ storage }).stats();
    assert.equal(stats.sessions, 20);
    assert.equal(stats.platePlays, 180);
    assert.equal(stats.generatedPlays, 20);
    assert.equal(stats.generatorMinutes, 20);
    assert.equal(stats.costCheckDue, true);
    assert.equal(stats.costCheckPass, true);
    assert.ok(stats.plateRatio >= 0.9);
  });
});
