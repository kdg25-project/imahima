import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpstreamTimeoutError, withUpstreamTimeout } from './upstream'

describe('withUpstreamTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('timeout時はAbortSignalをabortし、timerを残さない', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const pending = withUpstreamTimeout(
      (upstreamSignal) => {
        signal = upstreamSignal
        return new Promise<never>(() => {})
      },
      { timeoutMs: 50 },
    )

    const rejection = expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError)
    await vi.advanceTimersByTimeAsync(50)
    await rejection
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('完了時はtimeout timerをcleanupする', async () => {
    vi.useFakeTimers()
    await expect(withUpstreamTimeout(async () => 'ok', { timeoutMs: 50 })).resolves.toBe('ok')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('呼び出し元のAbortSignalをfetchへ伝播し、listenerとtimerをcleanupする', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    const removeListener = vi.spyOn(caller.signal, 'removeEventListener')
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) => new Promise<Response>(() => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const pending = withUpstreamTimeout(
      (signal) => fetch('https://example.test', { signal }),
      { signal: caller.signal, timeoutMs: 50 },
    )
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    caller.abort()
    await rejection

    const signal = fetchMock.mock.calls[0]?.[1]?.signal
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('すでにcancelされた呼び出し元signalを上流fetchへ渡す', async () => {
    vi.useFakeTimers()
    const caller = new AbortController()
    caller.abort()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) => new Promise<Response>(() => {
        expect(init?.signal?.aborted).toBe(true)
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      withUpstreamTimeout(
        (signal) => fetch('https://example.test', { signal }),
        { signal: caller.signal, timeoutMs: 50 },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
