/**
 * 管理后台 API 客户端
 * - 统一带上 admin_token
 * - 401 时自动跳转登录页
 * - 解析后端统一报错格式：{ ok:false, error:{code,message}, detail }
 */

function getToken(): string | null {
  return localStorage.getItem('admin_token')
}

function clearAndRedirect() {
  localStorage.removeItem('admin_token')
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

/** 结构化 API 错误 */
export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** 从响应体提取人类可读的错误信息（兼容新旧两种格式） */
function extractErrorMessage(data: unknown, fallback: string): { code: string; message: string } {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const err = d.error as Record<string, unknown> | undefined
    if (err && typeof err === 'object') {
      return {
        code: String(err.code || 'UNKNOWN'),
        message: String(err.message || d.detail || fallback),
      }
    }
    if (typeof d.detail === 'string' && d.detail) {
      return { code: 'UNKNOWN', message: d.detail }
    }
    if (typeof d.message === 'string' && d.message) {
      return { code: 'UNKNOWN', message: d.message }
    }
  }
  return { code: 'UNKNOWN', message: fallback }
}

export async function adminFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(input, { ...init, headers })

  if (res.status === 401) {
    clearAndRedirect()
  }
  return res
}

export async function adminFetchJson<T = unknown>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await adminFetch(input, init)
  if (!res.ok) {
    let code = 'UNKNOWN'
    let message = `请求失败（${res.status}）`
    try {
      const text = await res.text()
      if (text) {
        try {
          const parsed = JSON.parse(text)
          const extracted = extractErrorMessage(parsed, message)
          code = extracted.code
          message = extracted.message
        } catch {
          message = text.slice(0, 200) || message
        }
      }
    } catch {
      /* 忽略读取错误 */
    }
    throw new ApiError(code, message, res.status)
  }
  return res.json() as Promise<T>
}
