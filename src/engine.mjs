import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyEngine(root) {
  const lock = JSON.parse(await readFile(resolve(root, 'engine.lock.json'), 'utf8'));
  const receipt = JSON.parse(await readFile(resolve(root, '.cache/engine-receipt.json'), 'utf8'));
  if (receipt.revision !== lock.revision || receipt.patchSha256 !== await fileHash(resolve(root, lock.patch))) {
    throw new Error('Engine receipt does not match the pinned source and patch; rebuild the engine');
  }
  const directory = resolve(root, '.cache/bin');
  for (const name of ['codex', 'codex-code-mode-host']) {
    if (await fileHash(resolve(directory, name)) !== receipt.binaries[name]) {
      throw new Error('Engine binary integrity check failed; rebuild the engine');
    }
  }
  return resolve(directory, 'codex');
}

export function providerConfig(root, node = process.execPath) {
  return { agents: { providers: { 'codex-jev': {
    extends: 'codex', label: 'Codex · Jev compaction',
    command: [node, resolve(root, 'bin/paseo-jev-compaction.mjs'), 'codex'],
  } } } };
}

export function launchEnvironment(env, key) {
  const next = { ...env, PASEO_JEV_HISTORY: key ? 'on' : 'off' };
  delete next.PASEO_JEV_API_KEY;
  if (key) next.PASEO_JEV_API_KEY = key;
  return next;
}
