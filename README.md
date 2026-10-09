# paseo-jev-compaction

Use Jev history compaction with Codex in Paseo. This project adds a separate provider and keeps the standard Codex provider available.

Manual compaction and automatic compaction at the context limit try Jev first. If Jev fails or saves too few tokens, Codex handles compaction. Token-budget and model-transition compaction use Codex directly.

## Build

Requirements: macOS, Node.js 22+, Python 3.11+, Git and Rust 1.95.0.

```sh
npm run check
npm test
npm run build:engine
npm run smoke
node bin/paseo-jev-compaction.mjs doctor
```

The build uses `engine.lock.json` and `patches/history-only.patch`. It downloads Rust dependencies and pinned V8 artifacts. Builds and offline tests need no API key.

Before launch, the wrapper checks the source revision, patch hash and both executable hashes. Rebuild the engine if these checks fail.

## Connect

Generate a provider entry:

```sh
node bin/paseo-jev-compaction.mjs provider-config
```

Add `agents.providers.codex-jev` to your Paseo configuration. Keep your other settings. Select **Codex · Jev compaction** when you create an agent.

Installation does not change Paseo settings or restart the daemon. Paseo adds `app-server` to the command. The wrapper passes arguments, permissions, tool events and standard input/output through unchanged.

To stop using Jev, create an agent with the standard Codex provider. An active agent cannot change engines.

## Keys and models

The wrapper checks these key sources in order:

1. `TYPESAFE_AI_KEY` in the launch environment.
2. `TYPESAFE_API_KEY` in the launch environment.
3. One literal `TYPESAFE_AI_KEY` assignment in `~/.zprofile`.

It does not run shell commands from the profile. For command-based keys, use the launch environment.

The key stays in the engine's environment. The wrapper does not print it or save it in configuration or command arguments. Without a key, Jev is disabled, even if Codex has a saved Jev key. Codex authentication and `CODEX_HOME` stay unchanged.

The engine discovers models for its own version and account. Model names in another engine's cache do not prove access. An actual model response is required to verify support.

This pinned engine does not support `gpt-6.1-sol` with ChatGPT sign-in. Use standard Codex for that model. Jev compaction does not apply to the standard provider.

Use `PASEO_JEV_MODEL_CATALOG` only for an explicit catalog override. An invalid or missing file stops launch. Start a new engine to load configuration changes.

## History handling

Jev can remove complete, older `read_file`, `grep_files` and `list_dir` call/result pairs. It does not shorten their results.

User and assistant text, images, checkpoints and recent evidence stay intact. Writes, unknown tools, code-mode cells, failed outputs and running commands are protected. Separate outgoing-message and tool-output compression is disabled.

Jev receives a limited amount of text history, relevant instructions and complete candidate results. Private tool contents can reach the Jev API. Jev usage has a separate cost.

Each removal and the combined selection must meet the 0.95 safety threshold. Selection must save at least 25% of estimated tokens, including the recovery marker. API errors, timeouts, invalid probabilities, preservation failures or insufficient savings use Codex compaction. These checks cannot prove that no meaning is lost.

The engine saves original history under `CODEX_HOME/jev-originals` before replacement. Compacted history includes a recovery reference. Keep these private archives while sessions depend on them.

## Verification

Offline tests cover keys, engine integrity and provider configuration. Native scoped tests cover protected history and recoverable replacement. The smoke check lists models and starts a temporary thread without a model turn.

To check a real response, run the command below. It uses your Codex account and consumes model usage.

```sh
PASEO_JEV_SMOKE_LIVE=1 PASEO_JEV_SMOKE_MODEL=gpt-6-astra npm run smoke
```

Before relying on long sessions, compare continuation accuracy, total usage and compaction events with standard Codex. UI behavior, authentication, session resume and long-session behavior still need separate verification. Synthetic reduction figures do not prove production savings.

## Sources and license

The pinned engine comes from [codex-jev](https://github.com/yannip1234/codex-jev), based on [OpenAI Codex](https://github.com/openai/codex). The engine and patches retain Apache-2.0 attribution.

[fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) informed tool-pair selection. This project does not include its code.

Integration follows the [Paseo provider contract](https://github.com/getpaseo/paseo/blob/d1b705a0cd91617a5707fae25d80cb0be3057950/docs/custom-providers.md#custom-binary-for-a-provider) and [Codex app-server protocol](https://learn.chatgpt.com/docs/app-server).
