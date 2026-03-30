export const OPEN_BEACON_PROVIDERS = {
  local: {
    description: "Local ONNX (Zero-setup)",
    embedding: {
      provider: "local",
      model: "nomic-ai/nomic-embed-text-v1.5",
      api_key_env: "",
      dimensions: 768,
      batch_size: 10,
      query_prefix: "",
      quantized: true,
    },
  },
  ollama: {
    description: "Ollama (local server)",
    embedding: {
      provider: "ollama",
      api_base: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      api_key_env: "",
      dimensions: 768,
      batch_size: 10,
      query_prefix: "search_query: ",
      quantized: false,
    },
  },
  openai: {
    description: "OpenAI",
    embedding: {
      provider: "openai",
      api_base: "https://api.openai.com/v1",
      model: "text-embedding-3-small",
      api_key_env: "OPENAI_API_KEY",
      dimensions: 1536,
      batch_size: 100,
      query_prefix: "",
      quantized: false,
    },
  },
  voyage: {
    description: "Voyage AI",
    embedding: {
      provider: "openai",
      api_base: "https://api.voyageai.com/v1",
      model: "voyage-code-3",
      api_key_env: "VOYAGE_API_KEY",
      dimensions: 1024,
      batch_size: 50,
      query_prefix: "",
      quantized: false,
    },
  },
  litellm: {
    description: "LiteLLM proxy (Vertex AI, Bedrock, etc.)",
    embedding: {
      provider: "openai",
      api_base: "http://localhost:4000/v1",
      model: "voyage-code-3",
      api_key_env: "LITELLM_API_KEY",
      dimensions: 1024,
      batch_size: 50,
      query_prefix: "",
      quantized: false,
    },
  },
} as const

export type OpenBeaconProviderName = keyof typeof OPEN_BEACON_PROVIDERS
