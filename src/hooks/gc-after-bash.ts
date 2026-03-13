type IndexingServiceLike = {
  collectGarbage: () => Promise<string>
}

export function createGcAfterBashHook(indexingService: IndexingServiceLike): () => Promise<void> {
  return async () => {
    await indexingService.collectGarbage()
  }
}
