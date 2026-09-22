import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
    assert.ok(indexHtml.includes('src="assets/IMG_3542.jpeg"'), 'Chloe door uses a real photo');
    assert.ok(indexHtml.includes('src="assets/IMG_3543.jpeg"'), 'Bailey door uses a real photo');
    const characters = new Function(`return ${indexHtml.match(/const CHARACTERS = ({[\s\S]*?});\n\n    const CONFIG/)[1]};`)();
    assert.equal(characters.chloe.avatar, 'assets/IMG_3542.jpeg');
    assert.equal(characters.chloe.livingRoomMedia.fallbackImage, 'assets/IMG_3542.jpeg');
    assert.equal(characters.chloe.bedroomMedia.fallbackImage, 'assets/IMG_3548.jpeg');
    assert.equal(characters.chloe.livingRoomMedia.idleVideo, '');
    assert.equal(characters.bailey.avatar, 'assets/IMG_3543.jpeg');
    assert.equal(characters.bailey.livingRoomMedia.fallbackImage, 'assets/IMG_3543.jpeg');
    assert.equal(characters.bailey.bedroomMedia.fallbackImage, 'assets/IMG_3547.jpeg');
    assert.equal(characters.bailey.livingRoomMedia.idleVideo, '');
    assert.equal(characters.bailey.bedroomMedia.idleVideo, '');
    for (const id of Object.keys(characters)) {
      const char = characters[id];
      for (const url of [char.avatar, char.roomReferences.primaryWebcamView, char.livingRoomMedia.fallbackImage, char.bedroomMedia.fallbackImage]) {
        assert.match(url, /^assets\/IMG_/, `${id} image is a repo photo, not a placeholder`);
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
    assert.ok(indexHtml.includes('id="stage-skin-overlay"'), 'Customer stage keeps its passive frame');
  });

  await t.test('Webcam frame skins remain defined for the customer stage', () => {
    assert.ok(indexHtml.includes('skin-neon-cyber'), 'Neon Cyber webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-keyhole-gold'), 'Classic Keyhole Gold HUD webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-glass-vignette'), 'Minimalist Glass Vignette webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-streamer-vip'), 'Streamer VIP webcam skin CSS defined');
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
    assert.ok(adminHtml.includes('id="admin-stage-skin"'), 'Admin stage skin overlay element present');
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
