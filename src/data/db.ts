import Dexie, { type Table } from 'dexie'
import type {
  NavPage,
  Section,
  Bookmark,
  Category,
  UploadedIcon,
  Meta,
} from '../shared/types'
import { DEFAULT_APPEARANCE } from '../shared/types'
import { uuid, shortId, now } from '../shared/id'

/** 存目录句柄等不可序列化对象用单独的 kv 表 */
export interface KV {
  key: string
  value: unknown
}

export class MarkIsleDB extends Dexie {
  navPages!: Table<NavPage, string>
  sections!: Table<Section, string>
  bookmarks!: Table<Bookmark, string>
  categories!: Table<Category, string>
  uploadedIcons!: Table<UploadedIcon, string>
  meta!: Table<Meta, string>
  kv!: Table<KV, string>

  constructor() {
    // 保留旧 IndexedDB 名称，避免品牌改名后用户本地数据变成空库。
    super('bookmark-nav')
    this.version(1).stores({
      navPages: 'id, order, updatedAt, deleted',
      sections: 'id, pageId, order, updatedAt, deleted',
      bookmarks: 'id, sectionId, order, updatedAt, deleted, categoryId',
      categories: 'id, updatedAt, deleted',
      meta: 'key',
      kv: 'key',
    })
    // v2：升级到 LWW + Lamport 时钟模型，补齐旧数据缺失字段
    this.version(2)
      .stores({
        navPages: 'id, order, updatedAt, lamport, deleted',
        sections: 'id, pageId, order, updatedAt, lamport, deleted',
        bookmarks: 'id, sectionId, order, updatedAt, lamport, deleted, categoryId',
        categories: 'id, updatedAt, lamport, deleted',
        meta: 'key',
        kv: 'key',
      })
      .upgrade(async (tx) => {
        const meta = await tx.table('meta').get(META_KEY)
        const deviceId: string =
          meta?.deviceId ?? `${detectPlatform()}-${shortId()}`
        let clock = 0
        for (const name of ['navPages', 'sections', 'bookmarks', 'categories']) {
          const table = tx.table(name)
          const all = await table.toArray()
          for (const row of all) {
            clock += 1
            await table.put({
              ...row,
              lamport: row.lamport ?? clock,
              modifiedBy: row.modifiedBy ?? deviceId,
            })
          }
        }
        if (meta) {
          await tx
            .table('meta')
            .put({ ...meta, lamportClock: Math.max(meta.lamportClock ?? 0, clock) })
        }
      })
    // v3：本地上传的网站图标库，可在书签编辑器中复用
    this.version(3).stores({
      navPages: 'id, order, updatedAt, lamport, deleted',
      sections: 'id, pageId, order, updatedAt, lamport, deleted',
      bookmarks: 'id, sectionId, order, updatedAt, lamport, deleted, categoryId',
      categories: 'id, updatedAt, lamport, deleted',
      uploadedIcons: 'id, updatedAt, lamport, deleted',
      meta: 'key',
      kv: 'key',
    })
  }
}

export const db = new MarkIsleDB()

const META_KEY = 'app'

/** 获取（或初始化）本机元信息 */
export async function getMeta(): Promise<Meta> {
  let m = await db.meta.get(META_KEY)
  if (!m) {
    m = {
      key: META_KEY,
      deviceId: `${detectPlatform()}-${shortId()}`,
      deviceLabel: detectPlatform(),
      lastSyncAt: 0,
      lamportClock: 0,
      llmConfig: { enabled: false, endpoint: '', model: '' },
      appearance: DEFAULT_APPEARANCE,
    }
    await db.meta.put(m)
  } else if (!m.appearance) {
    m = { ...m, appearance: DEFAULT_APPEARANCE }
    await db.meta.put(m)
  } else {
    m = { ...m, appearance: { ...DEFAULT_APPEARANCE, ...m.appearance } }
  }
  return m
}

export async function updateMeta(patch: Partial<Meta>): Promise<Meta> {
  const m = await getMeta()
  const next = { ...m, ...patch, key: META_KEY }
  await db.meta.put(next)
  return next
}

/**
 * 取下一个 Lamport 时钟值并持久化。
 * Lamport 规则：tick = max(本机已知最大, 观察到的外部最大) + 1。
 * 写入本地记录时用本机时钟自增；合并远端时用 observeLamport 抬高时钟。
 */
let clockCache: number | null = null

export async function nextLamport(): Promise<number> {
  const m = await getMeta()
  const base = clockCache !== null ? Math.max(clockCache, m.lamportClock) : m.lamportClock
  const next = base + 1
  clockCache = next
  await db.meta.update(META_KEY, { lamportClock: next })
  return next
}

/** 合并远端后，用远端见过的最大 lamport 抬高本机时钟，确保后续写入单调递增 */
export async function observeLamport(externalMax: number): Promise<void> {
  const m = await getMeta()
  const merged = Math.max(m.lamportClock, externalMax, clockCache ?? 0)
  clockCache = merged
  if (merged !== m.lamportClock) {
    await db.meta.update(META_KEY, { lamportClock: merged })
  }
}

export async function currentDeviceId(): Promise<string> {
  return (await getMeta()).deviceId
}

function detectPlatform(): string {
  const ua = navigator.userAgent
  if (/Macintosh|Mac OS/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'PC'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Device'
}

/** 首次安装时灌入一个示例导航页，避免空屏 */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.navPages.filter((p) => !p.deleted).count()
  if (count > 0) return

  const meta = await getMeta()
  const dev = meta.deviceId
  const ts = now()
  const pageId = uuid()
  await db.navPages.put({
    id: pageId,
    title: '我的导航',
    order: 0,
    updatedAt: ts,
    lamport: await nextLamport(),
    modifiedBy: dev,
    version: 1,
    deleted: false,
  })

  const sections: Array<[string, string[]]> = [
    ['常用', ['https://github.com', 'https://www.google.com']],
    ['学习', ['https://developer.mozilla.org', 'https://stackoverflow.com']],
  ]
  let sOrder = 0
  for (const [title, urls] of sections) {
    const sectionId = uuid()
    await db.sections.put({
      id: sectionId,
      pageId,
      title,
      columns: 1,
      layoutSpan: 2,
      layoutW: 3,
      layoutH: 3,
      order: sOrder++,
      updatedAt: ts,
      lamport: await nextLamport(),
      modifiedBy: dev,
      version: 1,
      deleted: false,
    })
    let bOrder = 0
    for (const url of urls) {
      await db.bookmarks.put({
        id: uuid(),
        sectionId,
        title: new URL(url).hostname.replace(/^www\./, ''),
        url,
        order: bOrder++,
        updatedAt: ts,
        lamport: await nextLamport(),
        modifiedBy: dev,
        version: 1,
        deleted: false,
      })
    }
  }
}
