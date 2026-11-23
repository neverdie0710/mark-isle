import {
  db,
  getMeta,
  updateMeta,
  observeLamport,
  metaToSyncedAppearance,
  applySyncedAppearance,
} from './db'
import { mergeWithLocal, pickNewer } from './merge'
import type {
  DeviceSnapshot,
  NavPage,
  Section,
  Bookmark,
  Category,
  SyncedAppearance,
} from '../shared/types'
import { now } from '../shared/id'
import {
  FS_TIMEOUT_MS,
  PERMISSION_TIMEOUT_MS,
  isFsTimeout,
  isPermissionError,
  permissionAllowsUse,
  snapshotForDisk,
  withTimeout,
  type DirectoryPermission,
} from './fsAccess'

/**
 * 云盘目录同步。
 * 用 File System Access API 让用户授权一个云盘本地同步目录（iCloud Drive / 坚果云 / Dropbox …）。
 * 本机只写自己的 device-<id>.json；读取目录下所有 device-*.json 在本地合并。
 * 云盘客户端负责把文件搬到其它设备，无任何中心化服务。
 */

const DIR_HANDLE_KEY = 'syncDirHandle'
const SUBDIR = 'mark-isle'
const LEGACY_SUBDIR = 'bookmark-nav'

export type SyncStatus =
  | 'unconfigured' // 未授权目录
  | 'permission-needed' // 句柄存在但需重新授权
  | 'ok'
  | 'error'

export function isFileSystemAccessSupported(): boolean {
  return typeof (globalThis as any).showDirectoryPicker === 'function'
}

/** 让用户选择云盘目录，并持久化句柄以便复用授权。取消选择时返回 null。 */
export async function pickSyncDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null
  try {
    const handle = await (globalThis as any).showDirectoryPicker({
      id: 'mark-isle-sync',
      mode: 'readwrite',
    })
    await db.kv.put({ key: DIR_HANDLE_KEY, value: handle })
    return handle as FileSystemDirectoryHandle
  } catch {
    return null
  }
}

async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const row = await db.kv.get(DIR_HANDLE_KEY)
  return (row?.value as FileSystemDirectoryHandle) ?? null
}

export async function clearSyncDirectory(): Promise<void> {
  await db.kv.delete(DIR_HANDLE_KEY)
}

async function probePermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<DirectoryPermission> {
  const opts = { mode: 'readwrite' } as const
  try {
    // Chrome 对 iCloud 目录可能让 queryPermission 永远 pending。超时后换成重新选目录，不再碰旧句柄。
    const q = await withTimeout(
      // @ts-expect-error 实验性 API
      handle.queryPermission(opts),
      PERMISSION_TIMEOUT_MS,
      'queryPermission',
    )
    if (q === 'granted') return 'granted'
    if (!request) return q === 'denied' ? 'denied' : 'prompt'
    const r = await withTimeout(
      // @ts-expect-error 实验性 API
      handle.requestPermission(opts),
      PERMISSION_TIMEOUT_MS,
      'requestPermission',
    )
    return r === 'granted' ? 'granted' : 'denied'
  } catch (error) {
    if (isFsTimeout(error)) return 'unresponsive'
    return 'denied'
  }
}

async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  return permissionAllowsUse(await probePermission(handle, request))
}

export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    if (!isFileSystemAccessSupported()) return 'error'
    const handle = await loadDirHandle()
    if (!handle) return 'unconfigured'
    const ok = await ensurePermission(handle, false)
    return ok ? 'ok' : 'permission-needed'
  } catch (error) {
    console.warn('[fileSync] status failed:', error)
    return 'error'
  }
}

function openAppDir(root: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return withTimeout(
    root.getDirectoryHandle(SUBDIR, { create: true }),
    FS_TIMEOUT_MS,
    'getDirectoryHandle',
  )
}

async function getLegacyAppDir(
  root: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await withTimeout(
      root.getDirectoryHandle(LEGACY_SUBDIR),
      FS_TIMEOUT_MS,
      'legacy directory',
    )
  } catch {
    return null
  }
}

async function readLocalSnapshot(): Promise<DeviceSnapshot> {
  const meta = await getMeta()
  const [navPages, sections, bookmarks, categories] = await Promise.all([
    db.navPages.toArray(),
    db.sections.toArray(),
    db.bookmarks.toArray(),
    db.categories.toArray(),
  ])
  return {
    deviceId: meta.deviceId,
    deviceLabel: meta.deviceLabel,
    exportedAt: now(),
    appearance: metaToSyncedAppearance(meta),
    navPages,
    sections,
    bookmarks,
    categories,
  }
}

/** 原子写：先写临时文件再 move（云盘对完整文件的同步更安全） */
async function atomicWrite(
  dir: FileSystemDirectoryHandle,
  filename: string,
  content: string,
): Promise<void> {
  const fh = await withTimeout(
    dir.getFileHandle(filename, { create: true }),
    FS_TIMEOUT_MS,
    'getFileHandle',
  )
  const w = await withTimeout(fh.createWritable(), FS_TIMEOUT_MS, 'createWritable')
  await withTimeout(w.write(content), FS_TIMEOUT_MS, 'write')
  await withTimeout(w.close(), FS_TIMEOUT_MS, 'close')
}

async function readDeviceFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<DeviceSnapshot | null> {
  try {
    const fh = await withTimeout(dir.getFileHandle(filename), FS_TIMEOUT_MS, 'getFileHandle')
    const file = await withTimeout(fh.getFile(), FS_TIMEOUT_MS, 'getFile')
    const text = await withTimeout(file.text(), FS_TIMEOUT_MS, 'file.text')
    return JSON.parse(text) as DeviceSnapshot
  } catch {
    return null
  }
}

let syncInFlight: Promise<SyncStatus> | null = null

/**
 * 执行一次完整同步：写出本机文件 → 读入其它设备文件 → 合并写回本地。
 * 任何失败都静默返回，不影响本地使用。
 * 重叠调用共用同一次同步，避免新标签页可见性回调把挂起的目录操作再排一队。
 */
export function sync(options: { requestPermission?: boolean } = {}): Promise<SyncStatus> {
  const start = () => {
    let current: Promise<SyncStatus>
    current = runSync(options).finally(() => {
      if (syncInFlight === current) syncInFlight = null
    })
    syncInFlight = current
    return current
  }
  // 用户刚重新选完目录时必须再跑一遍，不能复用还在用旧句柄的那次同步。
  if (!syncInFlight) return start()
  if (!options.requestPermission) return syncInFlight
  return syncInFlight.then(start, start)
}

async function runSync(options: { requestPermission?: boolean } = {}): Promise<SyncStatus> {
  if (!isFileSystemAccessSupported()) return 'error'
  const handle = await loadDirHandle()
  if (!handle) return 'unconfigured'
  const granted = await ensurePermission(handle, options.requestPermission ?? false)
  if (!granted) return 'permission-needed'

  try {
    const dir = await openAppDir(handle)

    const meta = await getMeta()
    const myFile = `device-${meta.deviceId}.json`

    // 1) 写出本机快照。大背景图留在本地，避免云盘文件变成数 MB 占位。
    const local = await readLocalSnapshot()
    await atomicWrite(dir, myFile, JSON.stringify(snapshotForDisk(local), null, 2))

    // 2) 读入其它设备文件，并兼容旧品牌目录中的同步快照
    const remotes: DeviceSnapshot[] = []
    const legacyDir = await getLegacyAppDir(handle)
    const readDirs = legacyDir ? [dir, legacyDir] : [dir]
    for (const readDir of readDirs) {
      // 当前 DOM 类型还没有 entries()，运行时 Chrome 是支持的。
      const iter = (
        readDir as FileSystemDirectoryHandle & {
          entries: () => AsyncIterableIterator<[string, FileSystemHandle]>
        }
      ).entries()
      while (true) {
        const next = await withTimeout(iter.next(), FS_TIMEOUT_MS, 'directory.entries')
        if (next.done) break
        const [name, entry] = next.value
        if (entry.kind !== 'file') continue
        if (!name.startsWith('device-') || !name.endsWith('.json')) continue
        if (name === myFile) continue
        const snap = await readDeviceFile(readDir, name)
        if (snap) remotes.push(snap)
      }
    }

    // 3) 合并写回本地
    if (remotes.length > 0) {
      await applyMerge(local, remotes)
    }

    await updateMeta({ lastSyncAt: now() })
    return 'ok'
  } catch (e) {
    console.warn('[fileSync] sync failed:', e)
    return isPermissionError(e) ? 'permission-needed' : 'error'
  }
}

async function applyMerge(local: DeviceSnapshot, remotes: DeviceSnapshot[]) {
  const localAppearance = local.appearance
  const remoteAppearances = remotes
    .map((r) => r.appearance)
    .filter((a): a is SyncedAppearance => Boolean(a))
  const appearanceCandidates = [localAppearance, ...remoteAppearances].filter(
    (a): a is SyncedAppearance => Boolean(a),
  )
  const latestAppearance = appearanceCandidates.length
    ? appearanceCandidates.reduce((latest, item) => pickNewer(latest, item))
    : null

  const np = mergeWithLocal<NavPage>(
    local.navPages,
    remotes.map((r) => r.navPages ?? []),
  )
  const se = mergeWithLocal<Section>(
    local.sections,
    remotes.map((r) => r.sections ?? []),
  )
  const bm = mergeWithLocal<Bookmark>(
    local.bookmarks,
    remotes.map((r) => r.bookmarks ?? []),
  )
  const ca = mergeWithLocal<Category>(
    local.categories,
    remotes.map((r) => r.categories ?? []),
  )

  await db.transaction(
    'rw',
    db.navPages,
    db.sections,
    db.bookmarks,
    db.categories,
    async () => {
      if (np.changed.length) await db.navPages.bulkPut(np.changed)
      if (se.changed.length) await db.sections.bulkPut(se.changed)
      if (bm.changed.length) await db.bookmarks.bulkPut(bm.changed)
      if (ca.changed.length) await db.categories.bulkPut(ca.changed)
    },
  )

  if (
    latestAppearance
    && (!localAppearance || pickNewer(localAppearance, latestAppearance) !== localAppearance)
  ) {
    await applySyncedAppearance(latestAppearance)
  }

  // 用远端见过的最大 lamport 抬高本机逻辑时钟，保证后续本地写入单调递增、不会再被旧值压制
  const maxLamport = Math.max(
    np.maxLamport,
    se.maxLamport,
    bm.maxLamport,
    ca.maxLamport,
    latestAppearance?.lamport ?? 0,
  )
  await observeLamport(maxLamport)
}
