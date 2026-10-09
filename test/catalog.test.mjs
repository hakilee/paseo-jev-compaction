import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogArguments } from '../src/catalog.mjs';

test('standard model cache supplies complete metadata without rewriting the cache', async () => {
  const home = await mkdtemp(join(tmpdir(), 'paseo-jev-catalog-'));
  try {
    assert.deepEqual(await catalogArguments({}, home), []);
    await mkdir(join(home, '.codex'));
    const path = join(home, '.codex/models_cache.json');
    const source = JSON.stringify({ client_version: 'test', models: [{ slug: 'gpt-6.1-sol', context_window: 100000, supported_reasoning_levels: [{ effort: 'ultra' }] }] });
    await writeFile(path, source);
    assert.deepEqual(await catalogArguments({}, home), ['-c', `model_catalog_json=${JSON.stringify(path)}`]);
    assert.equal(await readFile(path, 'utf8'), source);
    assert.deepEqual(await catalogArguments({ CODEX_HOME: join(home, '.codex') }, '/other'), ['-c', `model_catalog_json=${JSON.stringify(path)}`]);
    await writeFile(path, '{"models":[]}');
    await assert.rejects(catalogArguments({}, home), /metadata/);
    await assert.rejects(catalogArguments({ PASEO_JEV_MODEL_CATALOG: join(home, 'missing') }, home), /Unable/);
  } finally { await rm(home, { recursive: true }); }
});
