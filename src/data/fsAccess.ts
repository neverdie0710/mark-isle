import type { DeviceSnapshot } from '../shared/types'

/** queryPermission 正常时应立刻返回。超过这个时间就视为浏览器不再应答。 */
export const PERMISSION_TIMEOUT_MS = 2000

/** 单次目录/文件操作的上限。云盘占位文件可能既不成功也不失败。 */
export const FS_TIMEOUT_MS = 12000

/**
 * 内嵌背景图超过这个长度就不再写入云盘快照。
 * 一张数 MB 的 data URL 会让 iCloud 把 device-*.json 收成占位文件，目录权限查询随后可能永远不返回。
 */
export const MAX_SYNCED_DATA_URL = 256 * 1024

export class FsTimeoutError extends Error {
  constructor(label = 'file system operation') {
    super(`${label} timed out`)
    this.name = 'FsTimeoutError'
  }
}

export function isFsTimeout(error: unknown): boolean {
  return error instanceof FsTimeoutError
}

/** 给可能永远不结束的 File System Access 调用加上限。原 Promise 无法取消，超时后只是不再等待它。 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new FsTimeoutError(label)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export type DirectoryPermission = 'granted' | 'prompt' | 'denied' | 'unresponsive'

/**
 * 只有明确 granted 才继续读写。
 * `unresponsive` 时同一句柄上的 getDirectoryHandle 也会一直挂起（iCloud 目录上复现过），
 * 不能再碰它。调用方应让用户重新选择文件夹，换一个新句柄。
 */
export function permissionAllowsUse(state: DirectoryPermission): boolean {
  return state === 'granted'
}

export function isPermissionError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  return name === 'NotAllowedError' || name === 'SecurityError'
}

/** 云盘快照只保留小图或普通 URL。大图继续留在本机 IndexedDB。 */
export function snapshotForDisk(snapshot: DeviceSnapshot): DeviceSnapshot {
  const appearance = snapshot.appearance
  const image = appearance?.config.backgroundImage
  if (!image || !image.startsWith('data:') || image.length <= MAX_SYNCED_DATA_URL) {
    return snapshot
  }
  return {
    ...snapshot,
    appearance: {
      ...appearance,
      config: { ...appearance.config, backgroundImage: '' },
    },
  }
}
