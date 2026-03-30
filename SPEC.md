# Open Beacon Plugin Spec

## Goal

`open-beacon-plugin` ports Beacon's Claude Code oriented integration into an OpenCode native plugin architecture inspired by `oh-my-opencode`.

The current implementation is fully native to Bun:

- OpenCode native plugin surface
- Bun based project and test workflow
- SQLite indexing and local embeddings using `@huggingface/transformers`
- Compatibility-oriented config loading for `.opencode` and legacy `.claude`
- Fully rewritten native indexing and search services, eliminating the need for wrapper scripts

## Design Principles

- Keep `src/index.ts` orchestration-only.
- Separate OpenCode glue (`plugin/`, `hooks/`, `tools/`) from core services (`core/`).
- Use Bun for package management and `bun test` for behavior-first tests.
- Support a zero-setup out-of-the-box experience via the `local` ONNX provider.

## Initialization Flow

```text
OpenBeaconPlugin(ctx)
  -> loadPluginConfig(directory)
  -> createManagers({ ctx, pluginConfig })
  -> createTools({ pluginConfig, managers })
  -> createHooks({ pluginConfig, managers })
  -> createPluginInterface({ hooks, tools })
```

## Config Layers

Merge order:

1. internal defaults
2. global OpenCode config: `~/.config/opencode/open-beacon.jsonc|json`
3. legacy Claude fallback: `<project>/.claude/beacon.json`
4. project OpenCode config: `<project>/.opencode/open-beacon.jsonc|json`

Rules:

- nested objects are deep-merged
- `disabled_tools` and `disabled_hooks` are union-merged with dedupe
- project OpenCode config wins over legacy Claude fallback

## Runtime Boundaries

### `src/core/`

Reusable services and adapters:

- `embedding/`: provider-based embedding execution (`LocalEmbedder` using ONNX, Ollama, OpenAI, etc.)
- `search/`: query execution, hybrid scoring (BM25 + vector + heuristics), and result normalization
- `indexing/`: SQLite storage, sync, reindex, re-embed, garbage collection
- `status/`: compact status and index visibility helpers
- `config/`: effective config inspection for tools

### `src/tools/`

OpenCode custom tools exposed by the plugin:

- `beacon_search`
- `beacon_index`
- `beacon_index_status`
- `beacon_reindex`
- `beacon_run_indexer`
- `beacon_config`

### `src/hooks/`

OpenCode lifecycle adapters:

- session created -> auto sync
- file edited -> re-embed file
- tool execute before grep -> semantic redirect guidance
- tool execute after bash -> GC
- session compacting -> inject Beacon health summary

### `src/plugin/`

OpenCode specific handler layer:

- event dispatcher
- tool registry
- pre/post tool handler wrappers

## Test Strategy

Use `bun test` with given/when/then style suites.

Initial coverage targets:

- config merge semantics
- tool registry filtering
- grep redirect heuristics
- plugin interface dispatch
- embedder abstractions and search services

## Non-Goals For This Phase

- shipping an install CLI
- fully migrating Beacon's SQLite and embedding implementation into Bun-native services
- auto-generating `.opencode/commands`, `.opencode/agents`, or `.opencode/skills`

Those can be added later once the plugin surface is stable.
