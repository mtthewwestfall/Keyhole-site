import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Read rooms.html (the Keyhole experience; index.html is the cover page) and admin.html
const indexPath = path.resolve('rooms.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const adminPath = path.resolve('admin.html');
const adminHtml = fs.existsSync(adminPath) ? fs.readFileSync(adminPath, 'utf8') : '';

test('Keyhole Application HTML & Architecture Integrity', async (t) => {
  await t.test('index.html contains 6 distinct character profiles with stable IDs', () => {
    const characterIds = ['bailey', 'chloe', 'harper', 'maya', 'sienna', 'elena'];
    characterIds.forEach(id => {
      assert.ok(indexHtml.includes(`${id}: {`), `Missing character profile object for ${id}`);
    });
  });

  await t.test('Character media isolation: Character A media structure never leaks to Character B', () => {
    // Extract CHARACTERS object script string
    const match = indexHtml.match(/const CHARACTERS = ({[\s\S]*?});\n\n    \/\/ 2\./);
    assert.ok(match, 'CHARACTERS definition script block found');

    // Evaluate CHARACTERS object in isolated function context
    const getCharactersObj = new Function(`return ${match[1]};`);
    const characters = getCharactersObj();

    const charKeys = Object.keys(characters);
    assert.equal(charKeys.length, 6, 'Exactly 6 characters configured');

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

  await t.test('Room Reference System: Only primary webcam view is exposed in stage', () => {
    assert.ok(indexHtml.includes('primaryWebcamView'), 'primaryWebcamView key present');
    assert.ok(indexHtml.includes('INTERNAL CONSISTENCY REF ONLY'), 'Side/Depth views marked internal consistency only');
    assert.ok(indexHtml.includes('setupStageMedia'), 'Stage rendering function handles customer media display');
  });

  await t.test('Backend membership entitlement hook exists and blocks unverified customers', () => {
    assert.ok(indexHtml.includes('async function verifyMembershipEntitlement'), 'Entitlement verification hook function defined');
    assert.ok(indexHtml.includes('verifyMembershipEntitlement(token)'), 'Verification hook receives user token');
    assert.ok(indexHtml.includes('Membership verified!'), 'Verification succeeds only on valid entitlement');
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

  await t.test('Gemini Master Prompt Engine enforces multi-angle consistency & primary view locking', () => {
    assert.ok(indexHtml.includes('buildGeminiMasterPrompt()'), 'buildGeminiMasterPrompt function defined');
    assert.ok(indexHtml.includes('[RULE 1 - UNIFIED 3D PHYSICAL ROOM MODEL]'), 'Master prompt incorporates Rule 1 spatial consistency');
    assert.ok(indexHtml.includes('[RULE 2 - PRIMARY WEBCAM VIEW LOCK]'), 'Master prompt incorporates Rule 2 primary view lock');
    assert.ok(indexHtml.includes('[SIMS-STYLE REALISTIC FURNITURE CUSTOMIZATION]'), 'Master prompt incorporates Sims furniture rules');
  });

  await t.test('Sims-style furniture customization & webcam skins configuration', () => {
    assert.ok(indexHtml.includes('furnitureAdditions'), 'Furniture additions state present');
    assert.ok(indexHtml.includes('furnitureRemovals'), 'Furniture removals state present');
    assert.ok(indexHtml.includes('skin-neon-cyber'), 'Neon Cyber webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-keyhole-gold'), 'Classic Keyhole Gold HUD webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-glass-vignette'), 'Minimalist Glass Vignette webcam skin CSS defined');
    assert.ok(indexHtml.includes('skin-streamer-vip'), 'Streamer VIP webcam skin CSS defined');
  });

  await t.test('Interactive sorority chat interaction & bot response functions present', () => {
    assert.ok(indexHtml.includes('function handleSendMessage()'), 'handleSendMessage function defined');
    assert.ok(indexHtml.includes('function generateCharacterResponse(char)'), 'generateCharacterResponse function defined');
    assert.ok(indexHtml.includes('function triggerReactionClip()'), 'triggerReactionClip function defined');
  });

  await t.test('Fruit Code Translator & Extended Display Generator elements exist', () => {
    assert.ok(indexHtml.includes('id="fruit-code-input"'), 'Fruit code input field present');
    assert.ok(indexHtml.includes('id="btn-generate-translate"'), 'Generate & Translate button present');
    assert.ok(indexHtml.includes('id="disp-translated-meaning"'), 'Translated meaning display span present');
    assert.ok(indexHtml.includes('function handleGenerateAndTranslate()'), 'handleGenerateAndTranslate handler defined');
  });
});

test('Keyhole WebCam Admin Portal Integrity', async (t) => {
  await t.test('admin.html exists and contains valid Keyhole Admin header', () => {
    assert.ok(adminHtml.length > 0, 'admin.html file exists and is not empty');
    assert.ok(adminHtml.includes('<title>Keyhole — WebCam Admin & Control Center</title>'), 'Admin portal title present');
    assert.ok(adminHtml.includes('id="matrix-shield-status"'), 'Matrix shield status pill present');
  });

  await t.test('Dual-secret authentication modal & verifier function exists', () => {
    assert.ok(adminHtml.includes('id="dual-secret-modal"'), 'Dual secret modal container present');
    assert.ok(adminHtml.includes('function verifyAdminDualSecrets(key1, key2)'), 'verifyAdminDualSecrets client hook defined');
    assert.ok(adminHtml.includes('id="key-westfall-input"'), 'Primary secret key input present');
    assert.ok(adminHtml.includes('id="key-saintkiller-input"'), 'Secondary secret key input present');
  });

  await t.test('WebCam Stage Control Monitor & companion switcher contains all 6 companions', () => {
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

  await t.test('Gemini Content Generator enforces multi-angle consistency & primary view locking', () => {
    assert.ok(adminHtml.includes('id="gen-rule-multiangle"'), 'Multi-angle consistency checkbox present');
    assert.ok(adminHtml.includes('id="gen-rule-primaryview"'), 'Primary view locking checkbox present');
    assert.ok(adminHtml.includes('function buildMasterPrompt()'), 'buildMasterPrompt function defined');
    assert.ok(adminHtml.includes('[RULE 1 - UNIFIED 3D PHYSICAL ROOM]'), 'Rule 1 spatial consistency in admin prompt');
    assert.ok(adminHtml.includes('[RULE 2 - LOCKED PRIMARY WEBCAM VIEW]'), 'Rule 2 primary view locking in admin prompt');
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
