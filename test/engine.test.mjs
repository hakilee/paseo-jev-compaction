import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyEngine, providerConfig, launchEnvironment } from '../src/engine.mjs';

test('Paseo config defines a separate provider and forwards CLI arguments', () => {
  assert.deepEqual(providerConfig('/project', '/node'), { agents: { providers: { 'codex-jev': {
    extends: 'codex', label: 'Codex · Jev compaction', command: ['/node', '/project/bin/paseo-jev-compaction.mjs', 'codex'],
  } } } });
});
test('missing key disables Jev even with an inherited stale wrapper key', () => {
  assert.deepEqual(launchEnvironment({ CODEX_HOME: '/original', PASEO_JEV_API_KEY: 'stale' }, undefined), { CODEX_HOME: '/original', PASEO_JEV_HISTORY: 'off' });
  assert.deepEqual(launchEnvironment({ CODEX_HOME: '/original' }, 'test-key'), { CODEX_HOME: '/original', PASEO_JEV_HISTORY: 'on', PASEO_JEV_API_KEY: 'test-key' });
});
test('engine integrity binds both binaries, patch and pinned revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'paseo-jev-engine-'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  try {
    await mkdir(join(root, '.cache/bin'), { recursive: true });
    await writeFile(join(root, 'engine.lock.json'), JSON.stringify({ revision: 'pinned', patch: 'patch' }));
    await writeFile(join(root, 'patch'), 'trusted patch');
    const binaries = { codex: hash('engine'), 'codex-code-mode-host': hash('helper') };
    await writeFile(join(root, '.cache/bin/codex'), 'engine');
    await writeFile(join(root, '.cache/bin/codex-code-mode-host'), 'helper');
    await writeFile(join(root, '.cache/engine-receipt.json'), JSON.stringify({ revision: 'pinned', patchSha256: hash('trusted patch'), binaries }));
    assert.equal(await verifyEngine(root), join(root, '.cache/bin/codex'));
    await writeFile(join(root, '.cache/bin/codex'), 'changed');
    await assert.rejects(verifyEngine(root), /integrity/);
    await writeFile(join(root, '.cache/bin/codex'), 'engine');
    await writeFile(join(root, 'patch'), 'changed patch');
    await assert.rejects(verifyEngine(root), /receipt/);
  } finally { await rm(root, { recursive: true }); }
});
