/**
 * The only place in the frontend that calls fetch().
 *
 * Centralised so that credentials, error shape and 401 handling are decided
 * once. In development, Vite proxies /api to Flask. In production, if
 * VITE_API_URL is configured, calls route to the backend domain directly.
 */

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/** Thrown for any non-2xx response. Carries the status so callers can branch. */
export class ApiError extends Error {
  constructor(message, { status, field = null, payload = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.field = field
    this.payload = payload
  }
}

/** Subscribers notified on a 401, so the auth context can clear its user. */
const unauthorizedHandlers = new Set()

export function onUnauthorized(handler) {
  unauthorizedHandlers.add(handler)
  return () => unauthorizedHandlers.delete(handler)
}

async function request(method, path, body, { signal } = {}) {
  let response
  const url = `${API_BASE}${path}`
  try {
    response = await fetch(url, {
      method,
      // Without this the session cookie is not sent and every call 401s.
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (networkError) {
    if (networkError.name === 'AbortError') throw networkError
    // A dead backend is the single most likely failure in local development,
    // so it gets a message that names the actual cause.
    throw new ApiError(
      'Cannot reach the FINWISE API. Is the Flask server running?',
      { status: 0 },
    )
  }

  if (response.status === 401) {
    unauthorizedHandlers.forEach((handler) => handler())
    throw new ApiError('Your session has expired. Please sign in again.', { status: 401 })
  }

  // 204 and other empty bodies would make response.json() throw.
  const text = await response.text()
  const data = text ? safeParse(text) : null

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, {
      status: response.status,
      field: data?.field,
      payload: data,
    })
  }

  return data
}

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    // A Flask traceback page or proxy error arrives as HTML, not JSON.
    return { error: 'The server returned an unexpected response.' }
  }
}

/** Build a query string, dropping empty values so the URL stays clean. */
export function qs(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, value)
  })
  const string = search.toString()
  return string ? `?${string}` : ''
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body ?? {}, options),
  put: (path, body, options) => request('PUT', path, body ?? {}, options),
  del: (path, options) => request('DELETE', path, undefined, options),

  /** For CSV/PDF endpoints: returns a Blob rather than parsed JSON. */
  async download(path) {
    const url = `${API_BASE}${path}`
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) {
      throw new ApiError(`Download failed (${response.status})`, { status: response.status })
    }
    const disposition = response.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="?([^";]+)"?/)
    return { blob: await response.blob(), filename: match ? match[1] : 'finwise-export' }
  },
}

/** Trigger a browser save dialog for a Blob from api.download(). */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
