import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Read rooms.html (the Keyhole experience; index.html is the cover page) and admin.html
const indexPath = path.resolve('rooms.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const coverPath = path.resolve('index.html');
const coverHtml = fs.readFileSync(coverPath, 'utf8');

const adminPath = path.resolve('admin.html');
const adminHtml = fs.existsSync(adminPath) ? fs.readFileSync(adminPath, 'utf8') : '';

test('Keyhole Application HTML & Architecture Integrity', async (t) => {
  await t.test('index.html cover page has door landing and sign-in panel', () => {
    assert.ok(coverHtml.includes('KEYHOLE'), 'Brand title present');
    assert.ok(coverHtml.includes('She’s here when you are.'), 'Landing headline present');
    assert.ok(coverHtml.includes('Private sessions. Two rooms. Sign in to enter.'), 'Landing subtitle present');
    assert.ok(coverHtml.includes('id="auth-panel"'), 'Slide-over dark authentication panel present');
    assert.ok(coverHtml.includes('I am 18 or older'), 'Age gate checkbox present');
  });

  await t.test('rooms.html contains distinct character profiles with stable IDs', () => {
    const characterIds = ['chloe', 'bailey'];
    characterIds.forEach(id => {
      assert.ok(indexHtml.includes(`${id}: {`), `Missing character profile object for ${id}`);
    });
  });

  await t.test('Character media isolation: Character A media structure never leaks to Character B', () => {
    // Extract CHARACTERS object script string
    const match = indexHtml.match(/const CHARACTERS = ({[\s\S]*?});\n\n    const CONFIG/);
    assert.ok(match, 'CHARACTERS definition script block found');

    // Evaluate CHARACTERS object in isolated function context
    const getCharactersObj = new Function(`return ${match[1]};`);
    const characters = getCharactersObj();

    const charKeys = Object.keys(characters);
    assert.ok(charKeys.length >= 2, 'Characters configured');

    charKeys.forEach(key => {
      const char = characters[key];
      assert.equal(char.id, key, `Character key ${key} matches its internal ID`);
      assert.ok(char.roomReferences, `Character ${key} has roomReferences`);
      assert.ok(char.roomReferences.primaryWebcamView, `Character ${key} has primaryWebcamView`);
      assert.ok(char.livingRoomMedia, `Character ${key} has livingRoomMedia`);
      assert.ok(char.bedroomMedia, `Character ${key} has bedroomMedia`);
      assert.ok(char.dialogue, `Character ${key} has character-specific dialogue`);
      assert.ok(char.dialogue.bedroomInvitation, `Character ${key} has bedroomInvitation dialogue`);
      assert.ok(char.dialogue.freeTimeEnding, `Character ${key} has freeTimeEnding dialogue`);
    });
  });

  await t.test('Two doors interface for Chloe and Bailey', () => {
    assert.ok(indexHtml.includes('id="door-chloe"'), 'Chloe door present');
    assert.ok(indexHtml.includes('id="door-bailey"'), 'Bailey door present');
    assert.ok(indexHtml.includes('Choose a door'), 'Door selection heading present');
  });

  await t.test('Customer doors and stage use real photos, not SVG placeholders', () => {
    assert.ok(!indexHtml.includes('data:image/svg+xml'), 'Customer room has no embedded SVG graphics');
    assert.ok(!coverHtml.includes('data:image/svg+xml'), 'Cover page has no embedded SVG graphics');
    assert.ok(!indexHtml.includes('commondatastorage.googleapis.com'), 'Customer stage does not play stock sample videos');
    assert.ok(indexHtml.includes('src="assets/chloe-1.jpg"'), 'Chloe door uses a real photo');
    assert.ok(indexHtml.includes('src="assets/bailey-1.jpg"'), 'Bailey door uses a real photo');
    assert.ok(indexHtml.includes('door-marquee'), 'Door photos run across the screen in a marquee');
    assert.ok(!indexHtml.includes('src="assets/IMG_3542.jpeg"'), 'Chloe empty-room grid photo removed from door');
    assert.ok(!indexHtml.includes('src="assets/IMG_3543.jpeg"'), 'Bailey empty-room grid photo removed from door');
    for (let i = 1; i <= 8; i++) assert.ok(indexHtml.includes(`src="assets/chloe-${i}.jpg"`), `Chloe door marquee includes chloe-${i}.jpg`);
    for (let i = 1; i <= 5; i++) assert.ok(indexHtml.includes(`src="assets/bailey-${i}.jpg"`), `Bailey door marquee includes bailey-${i}.jpg`);
    const characters = new Function(`return ${indexHtml.match(/const CHARACTERS = ({[\s\S]*?});\n\n    const CONFIG/)[1]};`)();
    assert.equal(characters.chloe.avatar, 'assets/chloe-1.jpg');
    assert.equal(characters.chloe.livingRoomMedia.fallbackImage, 'assets/chloe-1.jpg');
    assert.equal(characters.chloe.bedroomMedia.fallbackImage, 'assets/chloe-3.jpg');
    assert.equal(characters.chloe.livingRoomMedia.idleVideo, '');
    assert.equal(characters.bailey.avatar, 'assets/bailey-1.jpg');
    assert.equal(characters.bailey.livingRoomMedia.fallbackImage, 'assets/bailey-1.jpg');
    assert.equal(characters.bailey.bedroomMedia.fallbackImage, 'assets/bailey-4.jpg');
    assert.equal(characters.bailey.livingRoomMedia.idleVideo, '');
    assert.equal(characters.bailey.bedroomMedia.idleVideo, '');
    for (const id of Object.keys(characters)) {
      const char = characters[id];
      for (const url of [char.avatar, char.roomReferences.primaryWebcamView, char.livingRoomMedia.fallbackImage, char.bedroomMedia.fallbackImage]) {
        assert.match(url, /^assets\//, `${id} image is a repo photo, not a placeholder`);
      }
    }
  });

  await t.test('Room Reference System: Only primary webcam view is exposed in stage', () => {
    assert.ok(indexHtml.includes('primaryWebcamView'), 'primaryWebcamView key present');
    assert.ok(indexHtml.includes('INTERNAL CONSISTENCY REF ONLY'), 'Side/Depth views marked internal consistency only');
    assert.ok(indexHtml.includes('setupStageMedia'), 'Stage rendering function handles customer media display');
  });

  await t.test('Backend membership entitlement hook exists and blocks unverified customers', () => {
    assert.ok(indexHtml.includes('async function verifyMembershipEntitlement'), 'Entitlement verification hook function defined');
    assert.ok(indexHtml.includes('verifyMembershipEntitlement(token)'), 'Verification hook receives user token');
    assert.ok(indexHtml.includes('Passcode verified!'), 'Verification succeeds on valid entitlement');
  });

  await t.test('Free preview sequence & state preservation hooks exist', () => {
    assert.ok(indexHtml.includes('freePreviewResponses'), 'Free preview responses included');
    assert.ok(indexHtml.includes('bedroomInvitation'), 'Bedroom invitation hook included');
    assert.ok(indexHtml.includes('freeTimeEnding'), 'Free time ending trigger included');
    assert.ok(indexHtml.includes('saveSessionState()'), 'Session state saved to localStorage');
    assert.ok(indexHtml.includes('loadSessionState()'), 'Session state loaded from localStorage');
  });

  await t.test('Media error fallbacks and mobile responsiveness', () => {
    assert.ok(indexHtml.includes('onerror'), 'onerror fallbacks present for stage video and images');
    assert.ok(indexHtml.includes('@media (min-width: 820px)'), 'Responsive media queries configured for mobile first');
  });

  await t.test('Customer room hides admin chrome; generators stay on admin.html', () => {
    const customerAdmin = [
      'id="gemini-studio-btn"',
      'id="gemini-studio-modal"',
      'id="gemini-prompt-output"',
      'id="fruit-code-input"',
      'Show Manager',
      'Content & Gemini Generator',
      'buildGeminiMasterPrompt()'
    ];
    customerAdmin.forEach(marker => {
      assert.ok(!indexHtml.includes(marker), `Customer room must not include ${marker}`);
    });
    assert.ok(!indexHtml.includes('id="reset-session-btn"'), 'Customer room must not include Reset Session');
    assert.ok(!indexHtml.includes('resetSessionState'), 'Customer room must not expose a session reset function');
    assert.ok(!indexHtml.includes('Gemini Studio'), 'Customer room must not mention Gemini Studio');
    assert.ok(!coverHtml.includes('id="reset-session-btn"'), 'Cover page must not include Reset Session');
    assert.ok(!coverHtml.includes('id="gemini-studio-btn"'), 'Cover page must not include Gemini Studio');
    assert.ok(indexHtml.includes('id="switch-character-btn"'), 'Change Room stays on the customer page');
    assert.ok(indexHtml.includes('>Change Room<'), 'Change Room label stays on the customer page');
    const customerButtons = [...indexHtml.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(m => m[0]);
    const header = indexHtml.match(/<header class="site-header">[\s\S]*?<\/header>/);
    assert.ok(header, 'Customer site header exists');
    assert.ok(!header[0].includes('Reset Session'), 'Customer header has no Reset Session');
    assert.ok(!header[0].includes('Gemini'), 'Customer header has no Gemini Studio');
    assert.ok(header[0].includes('Change Room'), 'Customer header keeps Change Room');
    assert.equal(customerButtons.filter(b => /Reset Session|Gemini Studio|Room Editor/.test(b)).length, 0, 'No customer button offers studio or session reset');
    assert.ok(adminHtml.includes('Show Manager'), 'Show Manager stays on admin.html');
    assert.ok(adminHtml.includes('Content & Gemini Generator'), 'Content generator stays on admin.html');
    assert.ok(adminHtml.includes('id="fruit-code-input"'), 'Extended display generator stays on admin.html');
    assert.ok(!indexHtml.includes('id="stage-skin-overlay"'), 'Customer stage has no skin overlay element');
  });

  await t.test('Skin system is fully removed from the customer stage', () => {
    assert.ok(!indexHtml.includes('skin-neon-cyber'), 'Neon Cyber webcam skin CSS removed');
    assert.ok(!indexHtml.includes('skin-chloe-girl'), 'Chloe face+hair lock skin CSS removed');
    assert.ok(!indexHtml.includes('skin-bailey-girl'), 'Bailey face+hair lock skin CSS removed');
    assert.ok(!indexHtml.includes('skin-glass-vignette'), 'Minimalist Glass Vignette webcam skin CSS removed');
    assert.ok(!indexHtml.includes('skin-streamer-vip'), 'Streamer VIP webcam skin CSS removed');
    assert.ok(!indexHtml.includes('chloe-skin.jpg'), 'Chloe skin photo reference removed');
    assert.ok(!indexHtml.includes('bailey-skin.jpg'), 'Bailey skin photo reference removed');
  });

  await t.test('Private room unlock requires a paid backend entitlement', () => {
    assert.ok(!indexHtml.includes('KEY-VIP-ROOM'), 'Public VIP key is not shipped in the customer page');
    assert.ok(!indexHtml.includes("startsWith('KEY-')"), 'KEY- prefix is not accepted in the browser');
    assert.ok(!indexHtml.includes("=== 'VIP'"), 'VIP is not accepted in the browser');
    assert.ok(!indexHtml.includes("=== 'MEMBER'"), 'MEMBER is not accepted in the browser');
    assert.ok(indexHtml.includes('function hasPaidBedroomAccess'), 'Paid entitlement check exists');
    assert.ok(indexHtml.includes("api('/keyhole/me')"), 'Entitlement is read from GET /keyhole/me');
    assert.ok(indexHtml.includes("api('/keyhole/session/start'"), 'Paid unlock starts a server session');
    assert.ok(indexHtml.includes('pendingBedroomRestore'), 'Saved bedroom mode is not trusted until the server agrees');
    const input = indexHtml.match(/<input[^>]*id="member-key-input"[^>]*>/);
    assert.ok(input, 'Passcode field exists');
    assert.ok(!/value\s*=\s*["'][^"']+["']/.test(input[0]), 'Passcode field starts empty');

    const fnMatch = indexHtml.match(/function hasPaidBedroomAccess\(me, previewMinutes\) \{[\s\S]*?\n    \}/);
    assert.ok(fnMatch, 'hasPaidBedroomAccess source can be evaluated');
    const hasPaidBedroomAccess = new Function('me', 'previewMinutes', `${fnMatch[0]}\nreturn hasPaidBedroomAccess(me, previewMinutes);`);
    assert.equal(hasPaidBedroomAccess(null, 10), false);
    assert.equal(hasPaidBedroomAccess({ webcam_minutes_left: 0, free_preview_available: true }, 10), false);
    assert.equal(hasPaidBedroomAccess({
      webcam_minutes_left: 10, free_preview_available: false, intro_available: true, session_active: false
    }, 10), false, 'Free preview minutes do not unlock the bedroom');
    assert.equal(hasPaidBedroomAccess({
      webcam_minutes_left: 10, session_active: true, session_minutes_left: 10,
      free_preview_available: false, intro_available: true
    }, 10), false, 'An active free-preview session does not unlock the bedroom');
    assert.equal(hasPaidBedroomAccess({
      webcam_minutes_left: 10, free_preview_available: true, intro_available: true
    }, 10), true, 'Purchased minutes before the free preview is claimed do unlock');
    assert.equal(hasPaidBedroomAccess({
      webcam_minutes_left: 10, free_preview_available: false, intro_available: false
    }, 10), true, 'A purchased intro unlocks');
    assert.equal(hasPaidBedroomAccess({
      webcam_minutes_left: 25, free_preview_available: false, intro_available: true
    }, 10), true, 'More time than the preview grant unlocks');
  });

  await t.test('Message credits are shown and loaded from Keyhole APIs', () => {
    assert.ok(indexHtml.includes('id="message-credits"'), 'Remaining messages are shown in the room');
    assert.ok(indexHtml.includes('id="message-credit-policy"'), 'Credit policy is visible on the session list');
    assert.ok(indexHtml.includes('verifiedPreviewMessages: 50'), 'Verified preview allowance is 50 messages');
    assert.ok(indexHtml.includes('purchaseMessageGrant: 100'), 'Each paid purchase adds 100 messages');
    assert.ok(indexHtml.includes("api('/keyhole/preview/claim'"), 'Preview claim is requested from the backend');
    assert.ok(indexHtml.includes('text_balance'), 'Rollover balance comes from the account');
    assert.ok(indexHtml.includes('Unused messages roll over'), 'Rollover is explained in the UI');
  });

  await t.test('Message count uses the server-computed total (preview + paid + package)', () => {
    // /keyhole/me returns messages_left = preview credits (while playing) +
    // paid message credits + package text balance. The UI must count that total,
    // not text_balance alone, or free-preview users see "0 messages" and get blocked.
    assert.ok(indexHtml.includes('me.messages_left'), 'messagesRemaining prefers the server-computed messages_left total');
    assert.ok(!indexHtml.includes('`${me.email || \'Signed in\'} · ${Number(me.text_balance) || 0} messages`'),
      'Account header no longer counts text_balance alone');
    assert.ok(!indexHtml.includes('(Number(me.text_balance) || 0) <= 0 && !me.free_preview_available'),
      'Send gate no longer blocks on text_balance alone');
  });

  await t.test('Interactive chat interaction & bot response functions present', () => {
    assert.ok(indexHtml.includes('function handleSendMessage()'), 'handleSendMessage function defined');
    assert.ok(indexHtml.includes('function generateCharacterResponse(char)'), 'generateCharacterResponse function defined');
    assert.ok(indexHtml.includes('function triggerReactionClip()'), 'triggerReactionClip function defined');
  });
});

test('Keyhole WebCam Admin Portal Integrity', async (t) => {
  await t.test('admin.html exists and contains valid Keyhole Admin header', () => {
    assert.ok(adminHtml.length > 0, 'admin.html file exists and is not empty');
    assert.ok(adminHtml.includes('<title>Keyhole — WebCam Admin & Control Center</title>'), 'Admin portal title present');
    assert.ok(adminHtml.includes('id="matrix-shield-status"'), 'Matrix shield status pill present');
  });

  await t.test('Admin authentication modal & verifier function exists', () => {
    assert.ok(adminHtml.includes('id="dual-secret-modal"'), 'Secret modal container present');
    assert.ok(adminHtml.includes('function verifyAdminSecret'), 'verifyAdminSecret client hook defined');
  });

  await t.test('WebCam Stage Control Monitor & companion switcher contains companions', () => {
    const companions = ['bailey', 'chloe', 'harper', 'maya', 'sienna', 'elena'];
    companions.forEach(c => {
      assert.ok(adminHtml.includes(`value="${c}"`), `Companion ${c} option present in admin stage switcher`);
    });
    assert.ok(adminHtml.includes('id="admin-stage-video"'), 'Admin stage video element present');
    assert.ok(!adminHtml.includes('id="admin-stage-skin"'), 'Admin stage skin overlay element removed');
    assert.ok(!adminHtml.includes('webcam-skin-select'), 'Admin webcam skin select removed');
    assert.ok(!adminHtml.includes('applyDualRegionSkins'), 'Admin dual-region skin function removed');
    assert.ok(!adminHtml.includes('chloe-skin.jpg'), 'Admin Chloe skin photo reference removed');
    assert.ok(!adminHtml.includes('bailey-skin.jpg'), 'Admin Bailey skin photo reference removed');
    assert.ok(adminHtml.includes('function renderStageMonitor()'), 'renderStageMonitor function defined');
  });

  await t.test('WebCam Show Manager & booking workflow functions present', () => {
    assert.ok(adminHtml.includes('id="shows-table-body"'), 'Shows table body present');
    assert.ok(adminHtml.includes('id="btn-demo-simulate"'), 'Demo simulate private request button present');
    assert.ok(adminHtml.includes('id="btn-create-pub-show"'), 'Create public show button present');
    assert.ok(adminHtml.includes('function renderShowsTable()'), 'renderShowsTable function defined');
    assert.ok(adminHtml.includes('function publishPreview('), 'publishPreview function defined');
  });

  await t.test('Gemini Content Generator enforces spatial consistency', () => {
    assert.ok(adminHtml.includes('id="gen-rule-multiangle"'), 'Multi-angle consistency checkbox present');
    assert.ok(adminHtml.includes('id="gen-rule-primaryview"'), 'Primary view locking checkbox present');
    assert.ok(adminHtml.includes('function buildMasterPrompt()'), 'buildMasterPrompt function defined');
  });

  await t.test('Secondary Image Generator controls exist and prevent hardcoded API keys', () => {
    assert.ok(adminHtml.includes('id="engine-primary-check"'), 'Primary engine radio button present');
    assert.ok(adminHtml.includes('id="engine-secondary-check"'), 'Secondary engine radio button present');
    assert.ok(adminHtml.includes('id="card-secondary-generator"'), 'Secondary generator card present');
    assert.ok(adminHtml.includes('id="btn-sec-gen-set-key"'), 'Prompt API Key button present');
    assert.ok(adminHtml.includes('id="sec-gen-api-key"'), 'Secondary generator API key input present');
    assert.ok(!adminHtml.includes('sec-gen-api-key" class="form-input" value="AIza'), 'No API key is hardcoded in source HTML');
  });

  await t.test('Fruit Code Translator & Extended Display Engine present in Admin', () => {
    assert.ok(adminHtml.includes('id="fruit-code-input"'), 'Fruit code input field present');
    assert.ok(adminHtml.includes('id="fruit-expand-surroundings"'), 'Expand surroundings checkbox present');
    assert.ok(adminHtml.includes('id="btn-translate-generate"'), 'Generate & Translate button present');
    assert.ok(adminHtml.includes('function handleFruitTranslation()'), 'handleFruitTranslation function defined');
  });

  await t.test('Gemini Studio and Reset Session live only in the admin office', () => {
    assert.ok(adminHtml.includes('id="gemini-studio-btn"'), 'Gemini Studio button is on admin.html');
    assert.ok(adminHtml.includes('>Gemini Studio & Room Editor<'), 'Gemini Studio keeps its label');
    assert.ok(adminHtml.includes('id="gemini-studio-modal"'), 'Gemini Studio modal is on admin.html');
    assert.ok(adminHtml.includes('id="gemini-prompt-output"'), 'Studio prompt output is on admin.html');
    assert.ok(adminHtml.includes('function buildGeminiMasterPrompt()'), 'Studio prompt builder is on admin.html');
    assert.ok(adminHtml.includes('function openGeminiStudioModal()'), 'Studio open path is on admin.html');
    assert.ok(adminHtml.includes('function applyGeminiRoomToStage()'), 'Apply to stage stays on admin.html');
    assert.ok(adminHtml.includes('function handleGenerateAndTranslate()'), 'Studio fruit translator stays on admin.html');
    assert.ok(adminHtml.includes('id="reset-session-btn"'), 'Reset Session button is on admin.html');
    assert.ok(adminHtml.includes('>Reset Session<'), 'Reset Session keeps its label');
    assert.ok(adminHtml.includes('function resetSessionState()'), 'Reset Session function is on admin.html');
    assert.ok(adminHtml.includes("localStorage.removeItem(CUSTOMER_SESSION_KEY)"), 'Reset clears the customer session record');
    assert.ok(adminHtml.includes('function requireAdminOffice()'), 'Office controls require the admin gate');
  });

  await t.test('WebCam Media Asset Library Manager controls exist', () => {
    assert.ok(adminHtml.includes('id="media-table-body"'), 'Media table body present');
    assert.ok(adminHtml.includes('id="btn-import-url"'), 'Import URL button present');
    assert.ok(adminHtml.includes('function renderMediaTable()'), 'renderMediaTable function defined');
  });
});

test('Keyhole Booking Flow & Admin Lives Tab', async (t) => {
  await t.test('booking modal builds offset-aware ISO from local datetime', () => {
    assert.ok(indexHtml.includes('function bookingLocalToISO'), 'bookingLocalToISO helper defined');
    const m = indexHtml.match(/function bookingLocalToISO\([\s\S]*?\n    \}/);
    assert.ok(m, 'bookingLocalToISO body found');
    assert.ok(m[0].includes('.toISOString()'), 'booking modal emits offset-aware ISO (toISOString)');
    assert.ok(indexHtml.includes('id="booking-time"'), 'datetime-local input present in booking modal');
  });

  await t.test('book-a-show button and booking API wiring present', () => {
    assert.ok(indexHtml.includes('id="book-show-btn"'), 'Book a Private Show button present');
    assert.ok(indexHtml.includes('id="booking-modal"'), 'Booking modal present');
    assert.ok(indexHtml.includes('/keyhole/booking-packages'), 'booking packages endpoint called');
    assert.ok(indexHtml.includes('/keyhole/bookings'), 'bookings endpoint called');
    assert.ok(indexHtml.includes('/keyhole/bookings/mine'), 'my-bookings endpoint called');
    assert.ok(indexHtml.includes('kh_pending_booking'), 'pending booking tracked in localStorage');
    assert.ok(indexHtml.includes('window.location = res.payment_url'), 'redirects to Stripe payment_url');
  });

  await t.test('my-shows renders the three booking states', () => {
    assert.ok(indexHtml.includes('id="my-shows-list"'), 'My shows list container present');
    assert.ok(indexHtml.includes('function renderMyShows'), 'renderMyShows defined');
    assert.ok(indexHtml.includes('PAYMENT_PENDING'), 'payment-pending state handled');
    assert.ok(indexHtml.includes('Complete payment'), 'complete-payment action rendered');
    assert.ok(indexHtml.includes('LIVE NOW'), 'live-now state rendered');
    assert.ok(indexHtml.includes('starts in'), 'upcoming countdown rendered');
  });

  await t.test('payment poll watches pending booking until webhook confirms', () => {
    assert.ok(indexHtml.includes('function maybeStartPendingBookingPoll'), 'pending booking poll defined');
    assert.ok(indexHtml.includes('setInterval(async () => {'), 'poll uses setInterval');
    assert.ok(indexHtml.includes('90000'), 'poll gives up after 90s');
    assert.ok(indexHtml.includes('Payment confirmed'), 'payment-confirmed notice rendered');
  });

  await t.test('live overlay reuses the existing stage, no fake video elements', () => {
    assert.ok(indexHtml.includes('id="stage-live-overlay"'), 'stage live overlay present');
    assert.ok(indexHtml.includes('function updateLiveOverlay'), 'updateLiveOverlay defined');
    assert.ok(indexHtml.includes('Your private show ends in'), 'live countdown text present');
    assert.ok(!indexHtml.includes('id="stage-live-video"'), 'no extra fake video element added');
  });

  await t.test('logged-out users are prompted to sign in before booking', () => {
    const m = indexHtml.match(/function openBookingModal\(\)[\s\S]*?\n    \}/);
    assert.ok(m, 'openBookingModal body found');
    assert.ok(m[0].includes("openAccountModal('login')"), 'booking prompts login when no token');
  });

  await t.test('admin lives tab calls the live-shows endpoint with admin auth', () => {
    assert.ok(adminHtml.includes('data-tab="tab-lives"'), 'Lives tab button present');
    assert.ok(adminHtml.includes('id="tab-lives"'), 'Lives tab section present');
    assert.ok(adminHtml.includes('id="lives-live-body"'), 'live-now table body present');
    assert.ok(adminHtml.includes('id="lives-upcoming-body"'), 'upcoming table body present');
    assert.ok(adminHtml.includes("'/admin/keyhole/shows/live'"), 'lives tab calls /admin/keyhole/shows/live');
    assert.ok(adminHtml.includes('function loadLives'), 'loadLives defined');
    assert.ok(adminHtml.includes('setInterval(loadLives, 30000)'), 'lives auto-refresh every 30s');
    assert.ok(adminHtml.includes('onTabActivated'), 'tab activation hook stops/starts lives refresh');
  });
});

test('Voice presets: she talks over the footage', async (t) => {
  const require = createRequire(import.meta.url);
  const VP = require('./voice-presets.js');

  await t.test('voice-presets.js exports the pure helpers', () => {
    for (const fn of ['presetDir', 'pickIndex', 'normalizeManifest', 'nextGapDelay', 'createPlayer']) {
      assert.equal(typeof VP[fn], 'function', fn + ' exported');
    }
  });

  await t.test('pickIndex stays in range and avoids immediate repeats', () => {
    assert.equal(VP.pickIndex(0, -1), -1, 'empty -> -1');
    assert.equal(VP.pickIndex(1, 0), 0, 'single -> 0');
    for (let n = 0; n < 200; n++) {
      const i = VP.pickIndex(41, 7);
      assert.ok(i >= 0 && i < 41, 'in range');
      assert.notEqual(i, 7, 'never repeats the last index');
    }
  });

  await t.test('normalizeManifest builds playable entries', () => {
    const out = VP.normalizeManifest('chloe', [
      { id: '001', text: 'hey you.', file: '001.mp3' },
      { id: 'bad' },
      null,
    ]);
    assert.equal(out.length, 1, 'drops entries without a file');
    assert.equal(out[0].url, 'assets/audio/presets/chloe/001.mp3', 'url built from dir + file');
    assert.deepEqual(VP.normalizeManifest('chloe', null), [], 'non-array -> []');
  });

  await t.test('nextGapDelay stays within bounds', () => {
    for (let n = 0; n < 50; n++) {
      const d = VP.nextGapDelay(35000, 70000);
      assert.ok(d >= 35000 && d <= 70000, 'within 35-70s');
    }
  });

  await t.test('chloe preset pack is complete on disk', () => {
    const manPath = path.resolve('assets/audio/presets/chloe/presets.json');
    assert.ok(fs.existsSync(manPath), 'presets.json exists');
    const manifest = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    assert.equal(manifest.length, 41, '41 preset lines');
    for (const e of manifest) {
      assert.ok(e.text && e.text.length > 0, 'line has text: ' + e.id);
      assert.ok(fs.existsSync(path.resolve('assets/audio/presets/chloe', e.file)), 'mp3 exists: ' + e.file);
    }
  });

  await t.test('bailey preset pack is complete on disk', () => {
    const manPath = path.resolve('assets/audio/presets/bailey/presets.json');
    assert.ok(fs.existsSync(manPath), 'presets.json exists');
    const manifest = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    assert.equal(manifest.length, 45, '45 preset lines');
    for (const e of manifest) {
      assert.ok(e.text && e.text.length > 0, 'line has text: ' + e.id);
      assert.ok(fs.existsSync(path.resolve('assets/audio/presets/bailey', e.file)), 'mp3 exists: ' + e.file);
    }
  });

  await t.test('rooms.html wires the voice layer into the room', () => {
    assert.ok(indexHtml.includes('<script src="voice-presets.js"></script>'), 'voice-presets.js loaded');
    assert.ok(indexHtml.includes('const voiceState'), 'voice state defined');
    assert.ok(indexHtml.includes('function playVoicePreset(charId)'), 'playVoicePreset defined');
    assert.ok(indexHtml.includes('function startVoiceForRoom(charId)'), 'startVoiceForRoom defined');
    assert.ok(indexHtml.includes('function stopVoiceScheduler()'), 'stopVoiceScheduler defined');
    assert.ok(indexHtml.includes('startVoiceForRoom(char.id)'), 'voice starts on room entry');
    assert.ok(indexHtml.includes('stopVoiceScheduler();'), 'voice stops when leaving the room');
    assert.ok(indexHtml.includes('playVoicePreset(state.activeCharId)'), 'a line plays when the guest types');
    assert.ok(indexHtml.includes('unlockVoiceOnce'), 'audio unlocked on first gesture');
    assert.ok(indexHtml.includes('35000, 70000'), 'gap filler scheduled every 35-70s');
  });
});
