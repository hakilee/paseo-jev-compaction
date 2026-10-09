import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileHash } from '../src/engine.mjs';
import { mkdir, readFile, writeFile, copyFile, chmod, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const lock = JSON.parse(await readFile(resolve(root, 'engine.lock.json'), 'utf8'));
if (process.platform !== 'darwin') throw new Error('The pinned engine build currently supports macOS only');
const source = resolve(process.env.PASEO_JEV_ENGINE_SOURCE ?? resolve(root, '.cache/engine-source'));
const run = (command, args, cwd = source) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, RUSTUP_TOOLCHAIN: lock.rust } });
  if (result.error || result.status !== 0) throw new Error(`Engine build step failed: ${command}`);
};
await mkdir(source, { recursive: true });
try { await readFile(resolve(source, '.git/HEAD')); } catch { run('git', ['init']); run('git', ['remote', 'add', 'origin', lock.repository]); }
const patch = await readFile(resolve(root, lock.patch));
const dirty = spawnSync('git', ['diff', '--quiet'], { cwd: source }).status !== 0;
if (dirty) {
  const diff = spawnSync('git', ['diff', '--unified=0', '--', 'codex-rs/config/src/jev.rs', 'codex-rs/core/src/jev_compact.rs', 'codex-rs/core/src/jev_compact_tests.rs'], { cwd: source, encoding: 'utf8' });
  const changed = spawnSync('git', ['diff', '--name-only'], { cwd: source, encoding: 'utf8' });
  if (diff.stdout !== patch.toString() || changed.stdout.trim().split('\n').length !== 3) throw new Error('Engine checkout contains unexpected edits; preserve them before rebuilding');
  run('git', ['apply', '--unidiff-zero', '--reverse', resolve(root, lock.patch)]);
}
run('git', ['fetch', '--depth', '1', lock.repository, lock.revision]);
run('git', ['checkout', '--detach', lock.revision]);
run('git', ['apply', '--unidiff-zero', '--check', resolve(root, lock.patch)]);
run('git', ['apply', '--unidiff-zero', resolve(root, lock.patch)]);
run('python3', ['macos-app/build-backend.py']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = { revision: lock.revision, patchSha256: hash(patch), binaries: {} };
await mkdir(resolve(root, '.cache/bin'), { recursive: true });
for (const name of ['codex', 'codex-code-mode-host']) {
  const input = resolve(source, 'codex-rs/target', lock.profile, name);
  const output = resolve(root, '.cache/bin', name);
  await copyFile(input, `${output}.new`); await chmod(`${output}.new`, 0o755); await rename(`${output}.new`, output);
  receipt.binaries[name] = await fileHash(output);
}
await writeFile(resolve(root, '.cache/engine-receipt.json'), JSON.stringify(receipt, null, 2));
console.log('Pinned engine built. Run npm run smoke before using it in Paseo.');
