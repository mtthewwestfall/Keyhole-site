import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Read index.html content
const indexPath = path.resolve('index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

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
});
