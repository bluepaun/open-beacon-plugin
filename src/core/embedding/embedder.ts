import type { OpenBeaconConfig } from "../../config/schema"

function batchArray<T>(array: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < array.length; index += size) {
    batches.push(array.slice(index, index + size))
  }
  return batches
}

type EmbeddingApiResponse = {
  data: Array<{ embedding: number[] }>
}

export class Embedder {
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
