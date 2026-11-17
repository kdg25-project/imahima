export class UpstreamTimeoutError extends Error {
  constructor() {
    super('Upstream request timed out')
  }
}

export async function withUpstreamTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  {
    signal: callerSignal,
    timeoutMs = 5_000,
  }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  let rejectAbort: (reason: unknown) => void
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject
  })
  const abort = () => {
    controller.abort()
    rejectAbort(new DOMException('The operation was aborted', 'AbortError'))
  }

  if (callerSignal?.aborted) abort()
  else callerSignal?.addEventListener('abort', abort, { once: true })

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
    rejectAbort(new UpstreamTimeoutError())
  }, timeoutMs)

  try {
    return await Promise.race([operation(controller.signal), aborted])
  } catch (error) {
    if (timedOut) throw new UpstreamTimeoutError()
    throw error
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', abort)
  }
}
