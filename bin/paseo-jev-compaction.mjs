#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveKey } from '../src/credentials.mjs';
import { verifyEngine, providerConfig, launchEnvironment } from '../src/engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'provider-config') {
    console.log(JSON.stringify(providerConfig(root), null, 2));
  } else if (command === 'doctor' || command === 'codex') {
    const engine = await verifyEngine(root);
    const credential = await resolveKey(process.env, resolve(homedir(), '.zprofile'));
    if (command === 'doctor') {
      console.log(JSON.stringify({ engineVerified: true, keyAvailable: Boolean(credential.key), keySource: credential.source, mode: credential.key ? 'history-only' : 'native', autoConfigured: false }, null, 2));
    } else {
      if (!credential.key) process.stderr.write('Jev key unavailable; using native Codex compaction.\n');
      const child = spawn(engine, args, { stdio: 'inherit', env: launchEnvironment(process.env, credential.key) });
      for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
      child.once('error', () => { process.stderr.write('Unable to start the verified engine.\n'); process.exitCode = 1; });
      child.once('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
    }
  } else {
    throw new Error('Usage: paseo-jev-compaction <provider-config|doctor|codex [arguments...]>');
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
