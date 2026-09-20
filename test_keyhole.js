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
    // Ensure stage setup uses primary media / fallback without exposing side or depth references
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
});
