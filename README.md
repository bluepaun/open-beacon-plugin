<h1 align="center">Open Beacon</h1>

<p align="center">
  <strong>Turn OpenCode into Beacon-style semantic search.</strong><br>
  Semantic code search that understands your codebase — find code by meaning, not just string matching.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> · <a href="#usage">Usage</a> · <a href="#embedding-models">Models</a> · <a href="#commands">Commands</a> · <a href="#configuration">Config</a>
</p>

---

This project is an OpenCode port/adaptation of the original Beacon plugin by `sagarmk`.

- Original project: `https://github.com/sagarmk/beacon-plugin`
- Original local source: `beacon-plugin/`
- OpenCode migration target: `open-beacon-plugin/`

Licensed under the MIT License. See `LICENSE`.

The README structure and product language here intentionally follow the original Beacon README closely, with the integration details rewritten for OpenCode.

---

## Quick Start

### 1. Install Ollama (local embeddings, free)

```bash
brew install ollama
ollama serve &
ollama pull nomic-embed-text
```

### 2. Configure the OpenCode plugin

You can enable the plugin in either place:

- global: `~/.config/opencode/opencode.json` for all projects
- project-local: `opencode.json` in the repo root for one project only

Add the plugin entry to whichever config you want to use:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@bluepaun/open-beacon-plugin"]
}
```

OpenCode installs npm plugins automatically with Bun at startup.

### 3. Add Open Beacon config

Open Beacon has its own config file separate from `opencode.json`:

- global: `~/.config/opencode/open-beacon.json` for shared defaults across projects
- project-local: `.opencode/open-beacon.json` in the repo root for project-specific overrides

Recommended setup:

Global `~/.config/opencode/open-beacon.json`

```json
{
  "embedding": {
    "api_base": "http://localhost:11434/v1",
    "model": "nomic-embed-text",
    "api_key_env": "",
    "dimensions": 768,
    "batch_size": 10,
    "query_prefix": "search_query: "
  }
}
```

Project-local `.opencode/open-beacon.json`

```json
{
  "storage": {
    "path": ".opencode/.beacon"
  }
}
```

You can use either file by itself, or both together. Project-local values override global ones.

### 4. Start OpenCode

That is it. On session start, Open Beacon can:
1. **Index your codebase** automatically in the background
2. **Re-embed changed files** as you edit
3. **Use hybrid search** across semantic similarity and keyword matching

## Usage

After installing, Open Beacon can index automatically on session start. Here are the essentials:

### Force a full re-index

Use the `beacon_reindex` tool.

Deletes existing embeddings and rebuilds from scratch — useful after switching models or if the index gets stale.

### Check index health

Use the `beacon_index` tool.

Example response shape:

```json
{
  "index": {
    "files_indexed": 38,
    "total_chunks": 109,
    "eligible_files": 38,
    "coverage_percent": 100,
    "avg_chunks_per_file": 2.9
  },
  "sync": {
    "status": "idle",
    "last_sync": "2026-03-01T04:30:21.453Z"
  },
  "config": {
    "model": "nomic-embed-text",
    "provider": "ollama"
  }
}
```

For a quick numeric summary, use `beacon_index_status`.

```json
{
  "files_indexed": 38,
  "total_chunks": 114,
  "last_sync": "2026-03-01T04:30:21.453Z",
  "embedding_model": "nomic-embed-text",
  "embedding_endpoint": "http://localhost:11434/v1"
}
```

### Search your codebase

Use `beacon_search` with a natural-language query:

```text
authentication flow
```

Typical response:

```json
[
  {
    "file": "src/middleware/auth.ts",
    "lines": "12-45",
    "similarity": "0.820",
    "score": "0.740",
    "preview": "export async function verifyAuth(req, res, next) { ... }"
  },
  {
    "file": "src/routes/login.ts",
    "lines": "8-32",
    "similarity": "0.780",
    "score": "0.650",
    "preview": "router.post('/login', async (req, res) => { ... }"
  }
]
```

Hybrid search combines **semantic similarity**, **BM25 keyword matching**, and **identifier boosting** — so searching `auth flow` can still find code about authentication even if it never uses the word `auth`.

Options: `topK`, `threshold`, `path`, and `hybrid=false` for pure vector-style ranking.

---

## Embedding Models

Open Beacon runs on **open-source models by default** — no API keys, no cloud costs, fully local via [Ollama](https://ollama.com).

| Model | Dims | Context | Speed | Best for |
|-------|------|---------|-------|----------|
| **nomic-embed-text** (default) | 768 | 8192 | Fast | General-purpose, great code search |
| **mxbai-embed-large** | 1024 | 512 | Fast | Higher accuracy, larger vectors |
| **snowflake-arctic-embed:l** | 1024 | 512 | Medium | Strong retrieval benchmarks |
| **all-minilm** | 384 | 512 | Very fast | Lightweight, low resource usage |

To switch models, pull with Ollama and update your config:

```bash
ollama pull mxbai-embed-large
```

```json
// .opencode/open-beacon.json
{
  "embedding": {
    "model": "mxbai-embed-large",
    "dimensions": 1024,
    "query_prefix": ""
  }
}
```

Then run `beacon_reindex` to rebuild with the new model.

### Cloud Providers

For cloud-hosted embeddings, create `.opencode/open-beacon.json` in your repo:

<details>
<summary><strong>OpenAI</strong></summary>

```bash
export OPENAI_API_KEY="sk-..."
```

```json
{
  "embedding": {
    "api_base": "https://api.openai.com/v1",
    "model": "text-embedding-3-small",
    "api_key_env": "OPENAI_API_KEY",
    "dimensions": 1536,
    "batch_size": 100,
    "query_prefix": ""
  }
}
```

</details>

<details>
<summary><strong>Voyage AI</strong></summary>

```bash
export VOYAGE_API_KEY="pa-..."
```

```json
{
  "embedding": {
    "api_base": "https://api.voyageai.com/v1",
    "model": "voyage-code-3",
    "api_key_env": "VOYAGE_API_KEY",
    "dimensions": 1024,
    "batch_size": 50,
    "query_prefix": ""
  }
}
```

</details>

<details>
<summary><strong>LiteLLM proxy</strong> (Vertex AI, Bedrock, Azure, etc.)</summary>

```bash
pip install litellm
litellm --model vertex_ai/text-embedding-004 --port 4000
```

```json
{
  "embedding": {
    "api_base": "http://localhost:4000/v1",
    "model": "vertex_ai/text-embedding-004",
    "api_key_env": "LITELLM_API_KEY",
    "dimensions": 1024,
    "batch_size": 50,
    "query_prefix": ""
  }
}
```

</details>

<details>
<summary><strong>Custom endpoint</strong></summary>

Any server implementing the OpenAI `/v1/embeddings` API will work. Set `api_base`, `model`, `dimensions`, and optionally `api_key_env` in `.opencode/open-beacon.json`.

</details>

## Commands

Open Beacon indexes your codebase automatically on session start and re-embeds files as you edit — no manual steps needed.

#### Search

| Tool / Companion Command | Description |
|---------|-------------|
| `beacon_search` / `/search-code` | Hybrid code search — semantic + keyword + BM25 matching. Supports path scoping |

#### Index

| Tool / Companion Command | Description |
|---------|-------------|
| `beacon_index` / `/index` | Visual overview — files, chunks, coverage, provider |
| `beacon_index_status` / `/index-status` | Quick health check — file count, chunk count, last sync |
| `beacon_reindex` / `/reindex` | Force full re-index from scratch |
| `beacon_run_indexer` / `/run-indexer` | Manually trigger indexing |
| `beacon_terminate_indexer` / `/terminate-indexer` | Kill a running sync process |

#### Config

| Tool / Companion Command | Description |
|---------|-------------|
| `beacon_config` / `/config` | View and modify Open Beacon configuration |
| `beacon_blacklist` / `/blacklist` | Prevent indexing of specific directories |
| `beacon_whitelist` / `/whitelist` | Allow indexing in otherwise-blacklisted directories |

Open Beacon automatically registers bundled slash commands like `/search-code` and `/index`, the **code-explorer** subagent, and the bundled `semantic-search` skill by adding `templates/.opencode/skills` to `config.skills.paths`. Template assets remain bundled under `templates/.opencode/` for reference.

<details>
<summary><strong>Why Beacon?</strong></summary>

- **Understands your questions** — ask where the auth flow is and get the relevant implementation, not every file containing `auth`
- **Query expansion** — searches for `auth` can also find `authentication`, `authorize`, and `login`
- **Stays in sync automatically** — hooks handle full index, incremental re-embedding on edits, and garbage collection
- **Resilient** — retries with backoff on transient failures and keeps keyword-only fallback available
- **Works with any embedding provider** — Ollama, OpenAI, Voyage AI, LiteLLM, or any OpenAI-compatible API
- **Gives OpenCode better context** — tools, companion commands, agent assets, and grep redirection for smarter search

</details>

<details>
<summary><strong>How It Works</strong></summary>

Open Beacon uses OpenCode plugin events and hooks to stay in sync with your codebase:

| Hook | Trigger | What it does |
|------|---------|-------------|
| `session.created` | Every session | Full index or diff-based catch-up |
| `file.edited` | File edits | Re-embeds the changed file |
| `tool.execute.after` | `bash` | Garbage collects embeddings for deleted files |
| `experimental.session.compacting` | Before context compaction | Injects index status so search capability survives compaction |
| `tool.execute.before` | `grep` | Redirects grep to Beacon for semantic-style queries when the index is healthy |

</details>

<details>
<summary><strong>Configuration</strong></summary>

Default configuration (`src/config/defaults.ts`):

```json
{
  "embedding": {
    "api_base": "http://localhost:11434/v1",
    "model": "nomic-embed-text",
    "api_key_env": "",
    "dimensions": 768,
    "batch_size": 10,
    "query_prefix": "search_query: "
  },
  "chunking": {
    "strategy": "hybrid",
    "max_tokens": 512,
    "overlap_tokens": 50
  },
  "indexing": {
    "include": ["**/*.ts", "**/*.tsx", "**/*.js", "..."],
    "exclude": ["node_modules/**", "dist/**", "..."],
    "max_file_size_kb": 500,
    "auto_index": true,
    "max_files": 10000,
    "concurrency": 4
  },
  "search": {
    "top_k": 10,
    "similarity_threshold": 0.35,
    "hybrid": {
      "enabled": true,
      "weight_vector": 0.4,
      "weight_bm25": 0.3,
      "weight_rrf": 0.3,
      "doc_penalty": 0.5,
      "identifier_boost": 1.5,
      "debug": false
    }
  },
  "storage": {
    "path": ".opencode/.beacon"
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `embedding.api_base` | `http://localhost:11434/v1` | Embedding API endpoint |
| `embedding.model` | `nomic-embed-text` | Embedding model name |
| `embedding.dimensions` | `768` | Vector dimensions (must match model) |
| `embedding.query_prefix` | `search_query: ` | Prefix prepended to search queries |
| `indexing.include` | Common code patterns | Glob patterns for files to index |
| `indexing.exclude` | `node_modules`, `dist`, etc. | Glob patterns to skip |
| `indexing.max_file_size_kb` | `500` | Skip files larger than this |
| `indexing.auto_index` | `true` | Auto-index on session start |
| `indexing.concurrency` | `4` | Number of files to index in parallel |
| `search.top_k` | `10` | Max results per query |
| `search.similarity_threshold` | `0.35` | Minimum similarity score |
| `search.hybrid.enabled` | `true` | Enable hybrid search |

#### Global and per-repo overrides

Open Beacon looks for config in these places:

- global: `~/.config/opencode/open-beacon.json`
- project-local: `.opencode/open-beacon.json`

These values are deep-merged with the built-in defaults, and project-local values override global ones.

Global example:

```json
{
  "embedding": {
    "api_base": "http://localhost:11434/v1",
    "model": "nomic-embed-text",
    "dimensions": 768,
    "query_prefix": "search_query: "
  }
}
```

Project-local example:

```json
{
  "embedding": {
    "api_base": "https://api.openai.com/v1",
    "model": "text-embedding-3-small",
    "api_key_env": "OPENAI_API_KEY",
    "dimensions": 1536
  },
  "indexing": {
    "include": ["**/*.py"],
    "max_files": 5000
  }
}
```

Legacy `.claude/beacon.json` is also supported as a fallback while migrating.

#### Storage

Open Beacon stores its SQLite database at `.opencode/.beacon/embeddings.db` by default. This file is auto-generated and safe to delete — run `beacon_reindex` to rebuild.

</details>

<details>
<summary><strong>Troubleshooting</strong></summary>

### What if Ollama is down?

Open Beacon degrades gracefully when the embedding server is unreachable — it never blocks your session.

| Scenario | Behavior |
|----------|----------|
| **Session start** | Sync is skipped or marked as failed, session continues normally |
| **Search** | Falls back to keyword-only FTS/BM25 search |
| **File edits** | Re-embedding fails and existing embeddings remain |
| **Status tools** | Work normally from local DB state |

Start Ollama at any time and run `beacon_run_indexer` to catch up.

### Manual indexing

| Tool | What it does |
|---------|-------------|
| `beacon_run_indexer` | Manually trigger indexing — useful when `auto_index` is off or after starting Ollama late |
| `beacon_reindex` | Force a full re-index from scratch |
| `beacon_terminate_indexer` | Kill a stuck sync process and clean up state |

### Checking index health

Run `beacon_index` for a full overview with coverage, file list, and provider info. For a quick numeric summary, use `beacon_index_status`.

Things to look for:
- **Low coverage %** — files may be excluded by glob patterns or file-size limits
- **Sync status errors** — usually means the embedding server was unreachable during the last sync
- **Stale index** — run `beacon_run_indexer` to refresh

### Verifying search

Run `beacon_search` with a test query to confirm search is working. If results include `FTS-only`, the embedding server is unreachable — search still works, but without semantic ranking.

</details>

## Development

```bash
bun test
bun run typecheck
```

Architecture notes are documented in `SPEC.md`.

## Publishing

To publish Open Beacon for other users:

```bash
bun run typecheck
bun test
bun run build
npm publish --access public
```

If you publish under a different npm scope, update the package name in `package.json` and the install snippet above.

## License

MIT. See `LICENSE`.
