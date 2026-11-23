import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

test('firestore.rules begins with rules_version 2 and default-deny safety net', () => {
  assert.match(rulesContent, /rules_version\s*=\s*'2';/);
  assert.match(rulesContent, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('every collection in firebase-blueprint.json has an explicit match block in firestore.rules', () => {
  const paths = Object.keys(blueprint.firestore);
  for (const collectionPath of paths) {
    const matchPattern = collectionPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      rulesContent,
      new RegExp(`match\\s+${matchPattern}`),
      `Missing match block for ${collectionPath}`
    );
  }
});

test('Dirty Dozen #1 & #2: Users cannot self-assign role or escalate role on update', () => {
  assert.match(rulesContent, /incoming\(\)\.role\s*==\s*'user'/);
  assert.match(rulesContent, /incoming\(\)\.role\s*==\s*existing\(\)\.role/);
});

test('Dirty Dozen #3: Strict key allowlists prevent shadow field injection', () => {
  assert.match(rulesContent, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(/);
});

test('Dirty Dozen #4: Users PII is strictly isolated to owner or admin', () => {
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*allow get: if isValidId\(userId\) && \(isOwner\(userId\) \|\| isAdmin\(\)\);/);
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*allow list: if isAdmin\(\);/);
});

test('Dirty Dozen #5: Admin verification mandates email_verified == true', () => {
  assert.match(rulesContent, /function isVerified\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;\s*\}/);
  assert.match(rulesContent, /function isAdmin\(\)\s*\{\s*return isVerified\(\)/);
});

test('Dirty Dozen #7 & #8: Personal collections including userChoices enforce userId == request.auth.uid', () => {
  for (const col of ['listeningHistory', 'bookmarks', 'dailyUnlocks', 'subscriptions', 'userChoices']) {
    const blockMatch = rulesContent.match(new RegExp(`match /${col}/\\{[^}]+\\}[\\s\\S]*?(?=\\n\\s*// \\d+\\.|\\n\\s*\\}\\s*\\})`));
    assert.ok(blockMatch, `Found rule block for ${col}`);
    assert.match(blockMatch[0], /existing\(\)\.userId == request\.auth\.uid/);
  }
});

test('Dirty Dozen #9 & #10: Path ID hardening, mediaRef, and choicePoint validation present', () => {
  assert.match(rulesContent, /function isValidId\(id\)/);
  assert.match(rulesContent, /function isValidMediaRef\(ref\)/);
  assert.match(rulesContent, /function isValidChoicePoint\(cp\)/);
  assert.match(rulesContent, /ref\.provider in \['demo', 'drive', 'youtube', 'gcs'\]/);
});

test('Dirty Dozen #11 & #12: Immutable fields and server request.time timestamps enforced', () => {
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.chosenAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
});

test('Phase 3: UserProfile supports preferredFormat and userChoices enforces owner-only writes', () => {
  assert.match(rulesContent, /'preferredFormat'/);
  assert.match(rulesContent, /function isValidUserChoice\(data, userChoiceId\)/);
  assert.match(rulesContent, /data\.userId == request\.auth\.uid/);
});
