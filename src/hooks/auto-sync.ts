type IndexingServiceLike = {
  autoSync: () => Promise<string>
}

export function createAutoSyncHook(indexingService: IndexingServiceLike): () => Promise<void> {
  return async () => {
    await indexingService.autoSync()
  }
}
