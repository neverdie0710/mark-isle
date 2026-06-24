export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function now(): number {
  return Date.now()
}

/** 短设备 id，用于文件名 device-<id>.json */
export function shortId(len = 4): string {
  return Math.random().toString(36).slice(2, 2 + len)
}
