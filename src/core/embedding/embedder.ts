import type { OpenBeaconConfig } from "../../config/schema"
import { pipeline, env } from "@huggingface/transformers"
import * as path from "node:path"
import * as os from "node:os"

function batchArray<T>(array: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < array.length; index += size) {
    batches.push(array.slice(index, index + size))
  }
  return batches
}

export interface Embedder {
  embedDocuments(texts: string[]): Promise<number[][]>
  embedQuery(query: string): Promise<number[]>
  ping(): Promise<{ ok: true } | { ok: false; error: string }>
  dispose?(): Promise<void>
}

type EmbeddingApiResponse = {
  data: Array<{ embedding: number[] }>
}

export class RemoteEmbedder implements Embedder {
  private readonly apiBase: string
  private readonly model: string
  private readonly apiKey: string
  private readonly dimensions: number
  private readonly batchSize: number
  private readonly queryPrefix: string

  constructor(config: OpenBeaconConfig) {
    this.apiBase = config.embedding.api_base
    this.model = config.embedding.model
    this.apiKey = config.embedding.api_key_env ? (process.env[config.embedding.api_key_env] ?? "") : ""
    this.dimensions = config.embedding.dimensions
    this.batchSize = config.embedding.batch_size
    this.queryPrefix = config.embedding.query_prefix
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    for (const batch of batchArray(texts, this.batchSize)) {
      const response = await this.fetchWithRetry(batch)
      embeddings.push(...response.data.map((row) => row.embedding))
    }
    return embeddings
  }

  async embedQuery(query: string): Promise<number[]> {
    const [embedding] = await this.embedDocuments([`${this.queryPrefix}${query}`])
    return embedding
  }

  async ping(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.embedDocuments(["test"])
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async fetchWithRetry(batch: string[], retries = 2, backoffMs = 1000): Promise<EmbeddingApiResponse> {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(`${this.apiBase}/embeddings`, {
          method: "POST",
          signal: AbortSignal.timeout(30_000),
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.model,
            input: batch,
            dimensions: this.dimensions,
          }),
        })

        if (!response.ok) {
          throw new Error(`Embedding API error ${response.status}: ${await response.text()}`)
        }

        return await response.json() as EmbeddingApiResponse
      } catch (error) {
        if (attempt < retries) {
          const delay = backoffMs * Math.pow(4, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
        throw error
      }
    }

    throw new Error("Unreachable retry state")
  }
}

const globalPipelines: any[] = []

export class LocalEmbedder implements Embedder {
  private readonly model: string
  private readonly batchSize: number
  private readonly queryPrefix: string
  private readonly quantized: boolean
  private pipelinePromise: Promise<any> | null = null

  constructor(config: OpenBeaconConfig) {
    this.model = config.embedding.model
    this.batchSize = config.embedding.batch_size
    this.queryPrefix = config.embedding.query_prefix
    this.quantized = config.embedding.quantized

    // Ensure models are stored in a predictable, persistent location
    env.cacheDir = path.join(os.homedir(), config.storage.path, "models")
  }

  private async getPipeline() {
    if (!this.pipelinePromise) {
      // Create pipeline to fetch ONNX model and tokenizer
      // using the provided model name (default: nomic-ai/nomic-embed-text-v1.5)
      this.pipelinePromise = pipeline("feature-extraction", this.model, {
        dtype: this.quantized ? "q8" : "fp32",
      } as any)
      
      this.pipelinePromise.then(p => {
        globalPipelines.push(p)
      }).catch(() => {})
    }
    return this.pipelinePromise
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const extractor = await this.getPipeline()
    const embeddings: number[][] = []

    for (const batch of batchArray(texts, this.batchSize)) {
      const output = await extractor(batch, { pooling: "mean", normalize: true })
      
      const batchSize = output.dims[0]
      const dimensions = output.dims[1]
      
      for (let i = 0; i < batchSize; i++) {
        const start = i * dimensions
        const end = start + dimensions
        const embeddingArray = Array.from(output.data.slice(start, end)) as number[]
        embeddings.push(embeddingArray)
      }
    }

    return embeddings
  }

  async embedQuery(query: string): Promise<number[]> {
    const [embedding] = await this.embedDocuments([`${this.queryPrefix}${query}`])
    return embedding
  }

  async ping(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.getPipeline()
      await this.embedDocuments(["test"])
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async dispose(): Promise<void> {
    if (this.pipelinePromise) {
      try {
        const extractor = await this.pipelinePromise
        if (extractor && typeof extractor.dispose === "function") {
          await extractor.dispose()
        }
      } catch (error) {
        // ignore errors during dispose
      }
      this.pipelinePromise = null
    }
  }
}

export function createEmbedder(config: OpenBeaconConfig): Embedder {
  if (config.embedding.provider === "local") {
    return new LocalEmbedder(config)
  }

  return new RemoteEmbedder(config)
}
