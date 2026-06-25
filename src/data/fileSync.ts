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

/** 让用户选择云盘目录，并持久化句柄以便复用授权 */
export async function pickSyncDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null
  const handle = await (globalThis as any).showDirectoryPicker({
    id: 'mark-isle-sync',
    mode: 'readwrite',
  })
  await db.kv.put({ key: DIR_HANDLE_KEY, value: handle })
  return handle as FileSystemDirectoryHandle
}

async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const row = await db.kv.get(DIR_HANDLE_KEY)
  return (row?.value as FileSystemDirectoryHandle) ?? null
}

export async function clearSyncDirectory(): Promise<void> {
  await db.kv.delete(DIR_HANDLE_KEY)
}

async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  const opts = { mode: 'readwrite' } as const
  // @ts-expect-error 实验性 API
  const q = await handle.queryPermission(opts)
  if (q === 'granted') return true
  if (!request) return false
  // @ts-expect-error 实验性 API
  const r = await handle.requestPermission(opts)
  return r === 'granted'
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (!isFileSystemAccessSupported()) return 'error'
  const handle = await loadDirHandle()
  if (!handle) return 'unconfigured'
  const ok = await ensurePermission(handle, false)
  return ok ? 'ok' : 'permission-needed'
}

async function getAppDir(
  request: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  const root = await loadDirHandle()
  if (!root) return null
  if (!(await ensurePermission(root, request))) return null
  return root.getDirectoryHandle(SUBDIR, { create: true })
}

async function getLegacyAppDir(
  root: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await root.getDirectoryHandle(LEGACY_SUBDIR)
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
  const fh = await dir.getFileHandle(filename, { create: true })
  const w = await fh.createWritable()
  await w.write(content)
  await w.close()
}

async function readDeviceFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<DeviceSnapshot | null> {
  try {
    const fh = await dir.getFileHandle(filename)
    const file = await fh.getFile()
    const text = await file.text()
    return JSON.parse(text) as DeviceSnapshot
  } catch {
    return null
  }
}

/**
 * 执行一次完整同步：写出本机文件 → 读入其它设备文件 → 合并写回本地。
 * 任何失败都静默返回，不影响本地使用。
 */
export async function sync(options: { requestPermission?: boolean } = {}): Promise<SyncStatus> {
  if (!isFileSystemAccessSupported()) return 'error'
  const handle = await loadDirHandle()
  if (!handle) return 'unconfigured'
  const granted = await ensurePermission(handle, options.requestPermission ?? false)
  if (!granted) return 'permission-needed'

  try {
    const dir = await getAppDir(options.requestPermission ?? false)
    if (!dir) return 'permission-needed'

    const meta = await getMeta()
    const myFile = `device-${meta.deviceId}.json`

    // 1) 写出本机快照
    const local = await readLocalSnapshot()
    await atomicWrite(dir, myFile, JSON.stringify(local, null, 2))

    // 2) 读入其它设备文件，并兼容旧品牌目录中的同步快照
    const remotes: DeviceSnapshot[] = []
    const legacyDir = await getLegacyAppDir(handle)
    const readDirs = legacyDir ? [dir, legacyDir] : [dir]
    for (const readDir of readDirs) {
      // @ts-expect-error async iterator on directory handle
      for await (const [name, entry] of readDir.entries()) {
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
    return 'error'
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
