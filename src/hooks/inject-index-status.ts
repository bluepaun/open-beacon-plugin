type StatusServiceLike = {
  getCompactStatus: () => Promise<string>
}

export function createInjectIndexStatusHook(statusService: StatusServiceLike) {
  return async (output: { context: string[] }): Promise<void> => {
    const status = await statusService.getCompactStatus()

    if (!status) {
      return
    }

    output.context.push(status)
  }
}
