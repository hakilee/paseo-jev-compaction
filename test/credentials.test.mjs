import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { literalProfileKey, resolveKey } from '../src/credentials.mjs';

test('profile literal handling supports quoted, bare and commented exports', () => {
  for (const input of ['export TYPESAFE_AI_KEY="test-key"', "TYPESAFE_AI_KEY='test-key' # comment", 'TYPESAFE_AI_KEY=test-key']) {
    assert.equal(literalProfileKey(input), 'test-key');
  }
});
test('profile commands and ambiguous assignments are never evaluated', () => {
  for (const input of ['TYPESAFE_AI_KEY=$(touch /tmp/no)', 'TYPESAFE_AI_KEY="${OTHER_KEY}"', 'TYPESAFE_AI_KEY="`env`"', 'TYPESAFE_AI_KEY=x; echo secret', 'TYPESAFE_AI_KEY=a\nTYPESAFE_AI_KEY=b']) {
    assert.equal(literalProfileKey(input), undefined);
  }
});
test('inherited key has precedence and needs no readable profile', async () => {
  assert.deepEqual(await resolveKey({ TYPESAFE_AI_KEY: 'synthetic-key', TYPESAFE_API_KEY: 'other' }, '/missing/profile'), { key: 'synthetic-key', source: 'environment' });
});
test('literal profile fallback and missing key are distinct', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'paseo-jev-key-'));
  try {
    const file = join(dir, 'profile');
    assert.deepEqual(await resolveKey({}, file), { source: 'missing' });
    await writeFile(file, 'export TYPESAFE_AI_KEY="synthetic-profile-key"');
    assert.deepEqual(await resolveKey({}, file), { key: 'synthetic-profile-key', source: 'profile-literal' });
  } finally { await rm(dir, { recursive: true }); }
});
