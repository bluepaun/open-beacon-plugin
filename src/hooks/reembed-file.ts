type IndexingServiceLike = {
  reembedFile: (filePath: string) => Promise<string>
}

export function createReembedFileHook(indexingService: IndexingServiceLike): (filePath: string) => Promise<void> {
  return async (filePath: string) => {
    if (!filePath) {
      return
    }

    await indexingService.reembedFile(filePath)
  }
}
