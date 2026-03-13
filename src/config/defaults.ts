import type { OpenBeaconConfig } from "./schema"

export const OPEN_BEACON_DEFAULT_CONFIG: OpenBeaconConfig = {
  embedding: {
    api_base: "http://localhost:11434/v1",
    model: "nomic-embed-text",
    api_key_env: "",
    dimensions: 768,
    batch_size: 10,
    query_prefix: "search_query: ",
  },
  chunking: {
    strategy: "hybrid",
    max_tokens: 512,
    overlap_tokens: 50,
  },
  indexing: {
    include: [
      "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx",
      "**/*.py", "**/*.go", "**/*.rs", "**/*.java",
      "**/*.rb", "**/*.php", "**/*.sql", "**/*.md",
    ],
    exclude: [
      "node_modules/**", "dist/**", "build/**",
      ".next/**", "*.lock", "*.min.js",
    ],
    max_file_size_kb: 500,
    auto_index: true,
    max_files: 10000,
    concurrency: 4,
  },
  search: {
    top_k: 10,
    similarity_threshold: 0.35,
    hybrid: {
      enabled: true,
      weight_vector: 0.4,
      weight_bm25: 0.3,
      weight_rrf: 0.3,
      doc_penalty: 0.5,
      identifier_boost: 1.5,
      debug: false,
    },
  },
  storage: {
    path: ".opencode/.beacon",
  },
  intercept: {
    enabled: true,
    min_pattern_length: 4,
  },
  hooks: {
    auto_sync: true,
    reembed_on_edit: true,
    gc_after_bash: true,
    grep_redirect: true,
    compact_status: true,
  },
  disabled_tools: [],
  disabled_hooks: [],
  compat: {
    claude_config_fallback: true,
    claude_storage_fallback: true,
  },
  safety: {
    global_config_path: "~/.config/opencode/open-beacon-global.json",
  },
}
