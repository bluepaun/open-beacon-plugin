# Open Beacon Plugin Spec

## Goal

`open-beacon-plugin` ports Beacon's Claude Code oriented integration into an OpenCode native plugin architecture inspired by `oh-my-opencode`.

The initial implementation is a phase-1 adapter:

- OpenCode native plugin surface
- Bun based project and test workflow
- thin entrypoint with factory composition
- wrapper services around Beacon's existing script-based core
- compatibility-oriented config loading for `.opencode` and legacy `.claude`

## Design Principles

- Keep `src/index.ts` orchestration-only.
- Keep Beacon search/index logic outside the entrypoint.
- Separate OpenCode glue (`plugin/`, `hooks/`, `tools/`) from core services (`core/`).
- Preserve a migration path from legacy Beacon scripts before fully rewriting the core.
- Use Bun for package management and `bun test` for behavior-first tests.

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

- `runtime/`: command execution and legacy Beacon script invocation
- `search/`: query execution and result normalization
- `indexing/`: sync, reindex, re-embed, garbage collection
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

## Phase 1 Compatibility Model

The current scaffold wraps legacy Beacon scripts instead of rewriting all internals immediately.

- `runtime.beacon_root` points at the existing Beacon core checkout or a future vendored core directory.
- Node scripts are executed through a Bun-friendly shell abstraction.
- Missing `runtime.beacon_root` is treated as a configuration error at execution time, not at plugin load time.

## Test Strategy

Use `bun test` with given/when/then style suites.

Initial coverage targets:

- config merge semantics
- tool registry filtering
- grep redirect heuristics
- plugin interface dispatch

## Non-Goals For This Phase

- shipping an install CLI
- fully migrating Beacon's SQLite and embedding implementation into Bun-native services
- auto-generating `.opencode/commands`, `.opencode/agents`, or `.opencode/skills`

Those can be added later once the plugin surface is stable.
