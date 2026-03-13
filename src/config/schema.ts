import { z } from "zod"

export const OpenBeaconEmbeddingConfigSchema = z.object({
  api_base: z.string().default("http://localhost:11434/v1"),
  model: z.string().default("nomic-embed-text"),
  api_key_env: z.string().default(""),
  dimensions: z.number().int().positive().default(768),
  batch_size: z.number().int().positive().default(10),
  query_prefix: z.string().default("search_query: "),
})

export const OpenBeaconChunkingConfigSchema = z.object({
  strategy: z.enum(["syntax", "fixed", "hybrid"]).default("hybrid"),
  max_tokens: z.number().int().positive().default(512),
  overlap_tokens: z.number().int().nonnegative().default(50),
})

export const OpenBeaconIndexingConfigSchema = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  max_file_size_kb: z.number().int().positive().default(500),
  auto_index: z.boolean().default(true),
  max_files: z.number().int().positive().default(10000),
  concurrency: z.number().int().positive().default(4),
})

export const OpenBeaconHybridSearchConfigSchema = z.object({
  enabled: z.boolean().default(true),
  weight_vector: z.number().min(0).default(0.4),
  weight_bm25: z.number().min(0).default(0.3),
  weight_rrf: z.number().min(0).default(0.3),
  doc_penalty: z.number().min(0).default(0.5),
  identifier_boost: z.number().min(0).default(1.5),
  debug: z.boolean().default(false),
})

export const OpenBeaconSearchConfigSchema = z.object({
  top_k: z.number().int().positive().default(10),
  similarity_threshold: z.number().min(0).max(1).default(0.35),
  hybrid: OpenBeaconHybridSearchConfigSchema.default({
    enabled: true,
    weight_vector: 0.4,
    weight_bm25: 0.3,
    weight_rrf: 0.3,
    doc_penalty: 0.5,
    identifier_boost: 1.5,
    debug: false,
  }),
})

export const OpenBeaconConfigSchema = z.object({
  embedding: OpenBeaconEmbeddingConfigSchema.default({
    api_base: "http://localhost:11434/v1",
    model: "nomic-embed-text",
    api_key_env: "",
    dimensions: 768,
    batch_size: 10,
    query_prefix: "search_query: ",
  }),
  chunking: OpenBeaconChunkingConfigSchema.default({
    strategy: "hybrid",
    max_tokens: 512,
    overlap_tokens: 50,
  }),
  indexing: OpenBeaconIndexingConfigSchema.default({
    include: [],
    exclude: [],
    max_file_size_kb: 500,
    auto_index: true,
    max_files: 10000,
    concurrency: 4,
  }),
  search: OpenBeaconSearchConfigSchema.default({
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
  }),
  storage: z.object({
    path: z.string().default(".opencode/.beacon"),
  }).default({ path: ".opencode/.beacon" }),
  intercept: z.object({
    enabled: z.boolean().default(true),
    min_pattern_length: z.number().int().positive().default(4),
  }).default({ enabled: true, min_pattern_length: 4 }),
  hooks: z.object({
    auto_sync: z.boolean().default(true),
    reembed_on_edit: z.boolean().default(true),
    gc_after_bash: z.boolean().default(true),
    grep_redirect: z.boolean().default(true),
    compact_status: z.boolean().default(true),
  }).default({
    auto_sync: true,
    reembed_on_edit: true,
    gc_after_bash: true,
    grep_redirect: true,
    compact_status: true,
  }),
  disabled_tools: z.array(z.string()).default([]),
  disabled_hooks: z.array(z.string()).default([]),
  compat: z.object({
    claude_config_fallback: z.boolean().default(true),
    claude_storage_fallback: z.boolean().default(true),
  }).default({ claude_config_fallback: true, claude_storage_fallback: true }),
  safety: z.object({
    global_config_path: z.string().default("~/.config/opencode/open-beacon-global.json"),
  }).default({ global_config_path: "~/.config/opencode/open-beacon-global.json" }),
})

export type OpenBeaconConfig = z.infer<typeof OpenBeaconConfigSchema>
export type OpenBeaconConfigInput = Partial<OpenBeaconConfig>

export type HookName =
  | "auto-sync"
  | "reembed-file"
  | "gc-after-bash"
  | "grep-redirect"
  | "compact-status"
