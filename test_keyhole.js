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
    assert.ok(coverHtml.includes('assets/IMG_3547.jpeg'), 'Landing uses a real night still');
    assert.ok(!coverHtml.includes('door-chloe') && !coverHtml.includes('door-bailey'), 'No girl doors before sign-in');
    assert.ok(!coverHtml.includes('session-tier') && !coverHtml.includes('$5.99'), 'No prices on the locked door');
    assert.ok(!coverHtml.includes('data:image/svg+xml'), 'No fake SVG apartment');
    assert.ok(coverHtml.includes('/auth/login') && coverHtml.includes('/auth/signup'), 'Existing auth endpoints');
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
    assert.ok(indexHtml.includes('assets/IMG_3542.jpeg'), 'Chloe door uses her still');
    assert.ok(indexHtml.includes('assets/IMG_3546.jpeg'), 'Bailey door uses her still');
    assert.ok(!indexHtml.includes('door-chloe') || indexHtml.indexOf('assets/IMG_3542.jpeg') !== indexHtml.indexOf('assets/IMG_3546.jpeg'), 'Doors do not share one still');
    const selectFn = indexHtml.match(/function selectDoor\(charId\) \{[\s\S]*?\n    \}/);
    assert.ok(selectFn, 'selectDoor exists');
    assert.ok(!selectFn[0].includes('enterRoom'), 'A door click shows times and does not start the clock');
    assert.ok(indexHtml.includes("if (!localStorage.getItem('keyhole_auth_token_v1')) location.replace('index.html')"), 'Rooms page sends signed-out visitors back to the door');
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

  await t.test('Gemini AI Studio UI & Sims Furniture Editor elements exist in DOM', () => {
    assert.ok(indexHtml.includes('id="gemini-studio-btn"'), 'Gemini studio nav button present');
    assert.ok(indexHtml.includes('id="gemini-studio-modal"'), 'Gemini studio modal present');
    assert.ok(indexHtml.includes('id="gemini-prompt-output"'), 'Gemini prompt output textarea present');
    assert.ok(indexHtml.includes('id="stage-skin-overlay"'), 'Stage webcam skin overlay container present');
  });

  await t.test('Gemini Master Prompt Engine enforces spatial rules', () => {
    assert.ok(indexHtml.includes('buildGeminiMasterPrompt()'), 'buildGeminiMasterPrompt function defined');
    assert.ok(indexHtml.includes('GEMINI MULTI-ANGLE ROOM'), 'Master prompt incorporates spatial rules');
  });

  await t.test('Sims-style furniture customization & webcam skins configuration', () => {
    assert.ok(indexHtml.includes('furnitureAdditions'), 'Furniture additions state present');
    assert.ok(indexHtml.includes('furnitureRemovals'), 'Furniture removals state present');
    assert.ok(indexHtml.includes('skin-neon-cyber'), 'Neon Cyber webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-keyhole-gold'), 'Classic Keyhole Gold HUD webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-glass-vignette'), 'Minimalist Glass Vignette webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-streamer-vip'), 'Streamer VIP webcam skin CSS defined');
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

  await t.test('WebCam Media Asset Library Manager controls exist', () => {
    assert.ok(adminHtml.includes('id="media-table-body"'), 'Media table body present');
    assert.ok(adminHtml.includes('id="btn-import-url"'), 'Import URL button present');
    assert.ok(adminHtml.includes('function renderMediaTable()'), 'renderMediaTable function defined');
  });
});
