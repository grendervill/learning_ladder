export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const code = typeof body?.error === "string" ? body.error : undefined
    const message =
      typeof body?.message === "string" && body.message.trim()
        ? body.message
        : code ?? `request_failed_${response.status}`
    throw new ApiError(message, code)
  }
  return (await response.json()) as T
}
