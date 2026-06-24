/** 从 URL 推导 favicon 地址。优先用 Google s2 服务，离线时回退到站点 /favicon.ico。 */
export function faviconUrl(pageUrl: string, online = navigator.onLine): string {
  try {
    const u = new URL(pageUrl)
    if (online) {
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`
    }
    return `${u.protocol}//${u.hostname}/favicon.ico`
  } catch {
    return ''
  }
}

export function domainOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function titleFromUrl(pageUrl: string): string {
  const d = domainOf(pageUrl)
  return d || pageUrl
}
