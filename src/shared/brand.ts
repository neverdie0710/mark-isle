export const APP_NAME = '签屿'
export const APP_NAME_EN = 'Mark Isle'

export function appIconUrl(size: 16 | 48 | 128 = 48): string {
  const path = `public/icons/icon${size}.png`
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path)
  }
  return `/${path}`
}
