import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';

const live = process.env.PASEO_JEV_SMOKE_LIVE === '1';
if (live && !process.env.PASEO_JEV_SMOKE_MODEL) throw new Error('Live smoke requires PASEO_JEV_SMOKE_MODEL');
const home = await mkdtemp(join(tmpdir(), 'paseo-jev-smoke-'));
const child = spawn(process.execPath, [resolve('bin/paseo-jev-compaction.mjs'), 'codex', 'app-server'], {
  env: live ? process.env : { ...process.env, CODEX_HOME: home }, stdio: ['pipe', 'pipe', 'pipe'],
});
const pending = new Map();
let nextId = 1;
let completedTurn;
let responseText = '';
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.method === 'item/agentMessage/delta') responseText += message.params.delta;
  if (message.method === 'turn/completed') completedTurn?.resolve(message.params.turn);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  clearTimeout(waiter.timer); pending.delete(message.id);
  if (message.error) waiter.reject(new Error(`RPC ${waiter.method} failed with code ${message.error.code}`));
  else waiter.resolve(message.result);
});
child.stderr.on('data', () => {});
child.on('error', () => { for (const waiter of pending.values()) waiter.reject(new Error('Engine failed to start')); });
child.on('exit', code => { for (const waiter of pending.values()) waiter.reject(new Error(`Engine exited (${code})`)); });
function request(method, params) {
  return new Promise((resolveRequest, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`RPC timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve: resolveRequest, reject, timer, method });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
}
try {
  const initialize = await request('initialize', { clientInfo: { name: 'codex_app_server_daemon', version: '0.1.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
  const expectedModel = process.env.PASEO_JEV_SMOKE_MODEL;
  const models = await request('model/list', { includeHidden: false });
  if (!Array.isArray(models?.data) || (expectedModel && !models.data.some(model => model.id === expectedModel))) throw new Error('Expected model missing from native catalog');
  const start = await request('thread/start', { ephemeral: true, cwd: home, approvalPolicy: 'never', sandbox: 'read-only', ...(expectedModel ? { model: expectedModel } : {}) });
  if (!initialize || typeof start?.thread?.id !== 'string') throw new Error('Unexpected app-server initialization/thread response');
  if (expectedModel && start.model !== expectedModel) throw new Error('Thread did not select the expected model');
  if (live) {
    const completion = new Promise((resolveTurn, reject) => {
      const timer = setTimeout(() => reject(new Error('Live model turn timed out')), 45000);
      completedTurn = { resolve: turn => { clearTimeout(timer); resolveTurn(turn); }, timer };
    });
    await request('turn/start', { threadId: start.thread.id, input: [{ type: 'text', text: 'Reply OK only. Do not use tools.' }], model: expectedModel, effort: 'low' });
    const turn = await completion;
    if (turn.status !== 'completed' || responseText.trim() !== 'OK') throw new Error(`Live model turn failed (${turn.status})`);
  }
  const receipt = { passed: true, ephemeral: true, modelTurns: live ? 1 : 0, modelCount: models.data.length, ...(expectedModel ? { selectedModel: start.model } : {}), scopedMethods: ['initialize', 'model/list', 'thread/start', ...(live ? ['turn/start'] : [])], note: live ? 'Real account model response verified; no compaction or Paseo UI acceptance claimed.' : 'Protocol initialization only; no compaction, real account or Paseo UI acceptance claimed.' };
  await writeFile('artifacts/smoke.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally {
  for (const waiter of pending.values()) clearTimeout(waiter.timer);
  clearTimeout(completedTurn?.timer);
  child.stdin.end(); child.kill('SIGTERM'); lines.close();
  await new Promise(resolveExit => !child.pid || child.exitCode !== null || child.signalCode !== null ? resolveExit() : child.once('exit', resolveExit));
  await rm(home, { recursive: true, force: true });
}
