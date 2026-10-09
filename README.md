# paseo-jev-compaction

Run a pinned Jev-enabled Codex engine as a separate Paseo provider. Manual and context-limit automatic compaction try conservative native history selection, then fall back to Codex compaction when selection fails or cannot save enough tokens. Token-budget and model-transition compaction keep native behavior.

## Build and verify

Requirements: macOS, Node.js 22+, Python 3.11+, Git and Rust 1.95.0. The engine is built from the revision in `engine.lock.json` with the reviewed patch in `patches/history-only.patch`. Building downloads Rust dependencies and pinned upstream V8 artifacts. No API key is required to build or run offline tests.

```sh
npm run check
npm test
npm run build:engine
npm run smoke
node bin/paseo-jev-compaction.mjs doctor
```

The wrapper verifies the engine source revision, patch hash and both executable hashes before launching. A failed integrity check requires rebuilding; it does not silently execute another engine.

## Connect to Paseo

Generate the provider entry:

```sh
node bin/paseo-jev-compaction.mjs provider-config
```

Merge the generated `agents.providers.codex-jev` entry into your Paseo configuration. Preserve other providers and settings. Select **Codex · Jev compaction** for a new test agent. Installing this project does not modify Paseo configuration, restart the daemon, or replace the standard Codex provider.

Paseo appends `app-server` to the configured command. The wrapper forwards arguments and stdio unchanged, including permissions and native tool events. Use the standard Codex provider to stop using this integration. An active agent cannot hot-swap its engine.

## Credentials and operation

The wrapper prefers inherited `TYPESAFE_AI_KEY`, then `TYPESAFE_API_KEY`. If neither is available, it reads a single literal `TYPESAFE_AI_KEY` assignment from `~/.zprofile`. It never evaluates shell commands or substitutions. Profiles using command substitution must provide the key through the launch environment.

The key is passed only through the child environment. It is not printed, written to a configuration file, or included in command arguments. Missing keys disable Jev for this engine, including unrelated saved Jev keys. Codex authentication and `CODEX_HOME` remain unchanged.

History-only mode disables the fork's independent outgoing-message and tool-output compression. It leaves user/assistant text, opaque checkpoints, images and recent evidence intact. Only complete older built-in `read_file`, `grep_files` and `list_dir` call/result pairs are candidates. Unknown tools, code-mode cells, writes, unsuccessful outputs and running command receipts remain protected. Entire pairs are retained or removed; results are never shortened to a prefix.

Jev receives bounded textual history, relevant instructions and complete candidate results. It must judge each removal safe and then independently judge combined removal safe at the engine's 0.95 threshold. This is probabilistic selection, not proof of semantic equivalence. The engine requires at least 25% estimated token savings including its recovery marker. API failure, invalid probabilities, timeout, failed preservation checks or insufficient savings use native compaction.

Original pre-compaction history is archived privately under the selected Codex home's `jev-originals` before replacement. A compacted history includes its recovery reference. Do not delete archives while dependent sessions still need them. Jev adds separate API usage and can receive private tool contents when this provider is enabled.

## Acceptance

Offline checks must prove credential handling, executable integrity and provider configuration. Native scoped tests must prove protected writes/errors/unknown calls, unchanged narrative/checkpoints and recoverable history replacement. A stdio smoke must initialize the actual engine and start an ephemeral thread without a model turn.

Before using real long-running work, compare continuation accuracy, actual total usage and accepted-compaction/fallback events against the standard provider. Synthetic reduction percentages and upstream tests do not establish production savings. Paseo UI acceptance, authentication/resume compatibility and physical long-session behavior are separate verification items.

## Sources and license

This project integrates [yannip1234/codex-jev](https://github.com/yannip1234/codex-jev), pinned in `engine.lock.json`, based on [OpenAI Codex](https://github.com/openai/codex). The engine and patches retain Apache-2.0 attribution. [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) informs the tool-pair selection approach; its code is not included here.

Paseo integration follows its [custom binary provider contract](https://github.com/getpaseo/paseo/blob/d1b705a0cd91617a5707fae25d80cb0be3057950/docs/custom-providers.md#custom-binary-for-a-provider). Native protocol expectations follow [Codex app-server documentation](https://learn.chatgpt.com/docs/app-server).
