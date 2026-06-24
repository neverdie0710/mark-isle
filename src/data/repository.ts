import { db, nextLamport, currentDeviceId } from './db'
import { uuid, now } from '../shared/id'
import type {
  NavPage,
  Section,
  Bookmark,
  Category,
  EntityKind,
} from '../shared/types'

/**
 * Repository：UI 唯一的数据入口。
 * 所有写操作永远先落地本地 IndexedDB（乐观更新），并打上同步戳：
 *   - updatedAt：物理时间戳（毫秒），跨设备冲突的首要判据（LWW，谁后改谁赢）
 *   - lamport：逻辑时钟，updatedAt 相同/时钟回拨时的 tiebreaker，保证多端收敛
 *   - modifiedBy：本设备 id，最终 tiebreaker
 *   - version：本机编辑计数（仅展示用）
 * 删除一律软删（deleted=true），保证删除能在多端传播。
 */

type AnyEntity = NavPage | Section | Bookmark | Category

export interface BookmarkImportItem {
  title: string
  url: string
  icon?: string
  note?: string
  categoryName: string
}

function tableOf(kind: EntityKind) {
  switch (kind) {
    case 'navPages':
      return db.navPages
    case 'sections':
      return db.sections
    case 'bookmarks':
      return db.bookmarks
    case 'categories':
      return db.categories
  }
}

/** 给实体打同步戳。每次写入都自增 lamport 并刷新 updatedAt。 */
async function stamp<T extends AnyEntity>(
  entity: T,
  opts: { deleted?: boolean } = {},
): Promise<T> {
  const [lamport, deviceId] = await Promise.all([nextLamport(), currentDeviceId()])
  return {
    ...entity,
    updatedAt: now(),
    lamport,
    modifiedBy: deviceId,
    version: (entity.version ?? 0) + 1,
    deleted: opts.deleted ?? entity.deleted ?? false,
  }
}

let syncHook: (() => void) | null = null
/** UI 启动后注入：写操作完成后触发一次（防抖）同步 */
export function setSyncHook(fn: () => void) {
  syncHook = fn
}
function notifyChanged() {
  try {
    syncHook?.()
  } catch {
    /* sync 失败不影响本地写入 */
  }
}

// ---------- 查询 ----------

export async function listNavPages(): Promise<NavPage[]> {
  const all = await db.navPages.filter((p) => !p.deleted).toArray()
  return all.sort((a, b) => a.order - b.order)
}

export async function listSections(pageId: string): Promise<Section[]> {
  const all = await db.sections
    .where('pageId')
    .equals(pageId)
    .filter((s) => !s.deleted)
    .toArray()
  return all.sort((a, b) => a.order - b.order)
}

export async function listBookmarks(sectionId: string): Promise<Bookmark[]> {
  const all = await db.bookmarks
    .where('sectionId')
    .equals(sectionId)
    .filter((b) => !b.deleted)
    .toArray()
  return all.sort((a, b) => a.order - b.order)
}

export async function listCategories(): Promise<Category[]> {
  return (await db.categories.filter((c) => !c.deleted).toArray()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

// ---------- NavPage ----------

export async function createNavPage(title: string): Promise<NavPage> {
  const order = (await db.navPages.count()) || 0
  const page = await stamp<NavPage>({
    id: uuid(),
    title,
    order,
    updatedAt: 0,
    lamport: 0,
    modifiedBy: '',
    version: 0,
    deleted: false,
  })
  await db.navPages.put(page)
  notifyChanged()
  return page
}

export async function updateNavPage(id: string, patch: Partial<NavPage>) {
  const cur = await db.navPages.get(id)
  if (!cur) return
  await db.navPages.put(await stamp({ ...cur, ...patch }))
  notifyChanged()
}

export async function deleteNavPage(id: string) {
  const cur = await db.navPages.get(id)
  if (!cur) return
  await db.navPages.put(await stamp(cur, { deleted: true }))
  // 级联软删该页下的区域与书签
  const sections = await db.sections.where('pageId').equals(id).toArray()
  for (const s of sections) await deleteSection(s.id, false)
  notifyChanged()
}

// ---------- Section ----------

export async function createSection(pageId: string, title: string): Promise<Section> {
  const order = await db.sections.where('pageId').equals(pageId).count()
  const section = await stamp<Section>({
    id: uuid(),
    pageId,
    title,
    columns: 1,
    layoutSpan: 2,
    layoutW: 3,
    layoutH: 3,
    order,
    updatedAt: 0,
    lamport: 0,
    modifiedBy: '',
    version: 0,
    deleted: false,
  })
  await db.sections.put(section)
  notifyChanged()
  return section
}

export async function updateSection(id: string, patch: Partial<Section>) {
  const cur = await db.sections.get(id)
  if (!cur) return
  await db.sections.put(await stamp({ ...cur, ...patch }))
  notifyChanged()
}

export async function deleteSection(id: string, notify = true) {
  const cur = await db.sections.get(id)
  if (!cur) return
  await db.sections.put(await stamp(cur, { deleted: true }))
  const bms = await db.bookmarks.where('sectionId').equals(id).toArray()
  for (const b of bms) {
    await db.bookmarks.put(await stamp(b, { deleted: true }))
  }
  if (notify) notifyChanged()
}

// ---------- Bookmark ----------

export async function createBookmark(
  sectionId: string,
  data: Pick<Bookmark, 'title' | 'url'> & Partial<Bookmark>,
): Promise<Bookmark> {
  const order = await db.bookmarks.where('sectionId').equals(sectionId).count()
  const bm = await stamp<Bookmark>({
    id: uuid(),
    sectionId,
    title: data.title,
    url: data.url,
    icon: data.icon,
    note: data.note,
    categoryId: data.categoryId,
    order,
    updatedAt: 0,
    lamport: 0,
    modifiedBy: '',
    version: 0,
    deleted: false,
  })
  await db.bookmarks.put(bm)
  notifyChanged()
  return bm
}

export async function importBookmarksToNewPage(
  pageTitle: string,
  items: BookmarkImportItem[],
): Promise<{ pageId: string; sections: number; bookmarks: number }> {
  const page = await createNavPage(pageTitle)
  const categories = new Map<string, Category>()
  const sections = new Map<string, Section>()
  const sectionOrders = new Map<string, number>()
  const grouped = new Map<string, BookmarkImportItem[]>()

  for (const item of items) {
    const categoryName = item.categoryName.trim() || '未分类'
    const group = grouped.get(categoryName) ?? []
    group.push(item)
    grouped.set(categoryName, group)
  }

  for (const categoryName of grouped.keys()) {
    const [category, section] = await Promise.all([
      upsertCategory(categoryName),
      createSection(page.id, categoryName),
    ])
    categories.set(categoryName, category)
    sections.set(categoryName, section)
    sectionOrders.set(section.id, 0)
  }

  const bookmarks: Bookmark[] = []
  for (const [categoryName, group] of grouped) {
    const section = sections.get(categoryName)
    const category = categories.get(categoryName)
    if (!section) continue
    for (const item of group) {
      const order = sectionOrders.get(section.id) ?? 0
      sectionOrders.set(section.id, order + 1)
      bookmarks.push(
        await stamp<Bookmark>({
          id: uuid(),
          sectionId: section.id,
          title: item.title,
          url: item.url,
          icon: item.icon,
          note: item.note,
          categoryId: category?.id,
          order,
          updatedAt: 0,
          lamport: 0,
          modifiedBy: '',
          version: 0,
          deleted: false,
        }),
      )
    }
  }

  if (bookmarks.length) await db.bookmarks.bulkPut(bookmarks)
  notifyChanged()
  return { pageId: page.id, sections: sections.size, bookmarks: bookmarks.length }
}

export async function updateBookmark(id: string, patch: Partial<Bookmark>) {
  const cur = await db.bookmarks.get(id)
  if (!cur) return
  await db.bookmarks.put(await stamp({ ...cur, ...patch }))
  notifyChanged()
}

export async function deleteBookmark(id: string) {
  const cur = await db.bookmarks.get(id)
  if (!cur) return
  await db.bookmarks.put(await stamp(cur, { deleted: true }))
  notifyChanged()
}

export async function moveBookmark(id: string, toSectionId: string, toOrder: number) {
  const cur = await db.bookmarks.get(id)
  if (!cur) return
  await db.bookmarks.put(await stamp({ ...cur, sectionId: toSectionId, order: toOrder }))
  notifyChanged()
}

type OrderedKind = Exclude<EntityKind, 'categories'>

/** 批量重排：传入有序 id 列表，按索引写回 order */
export async function reorder(kind: OrderedKind, orderedIds: string[]) {
  const t = tableOf(kind)
  for (let i = 0; i < orderedIds.length; i++) {
    const cur = (await t.get(orderedIds[i])) as
      | NavPage
      | Section
      | Bookmark
      | undefined
    if (cur && cur.order !== i) {
      await t.put((await stamp({ ...cur, order: i })) as never)
    }
  }
  notifyChanged()
}

// ---------- Category ----------

export async function upsertCategory(name: string, color?: string): Promise<Category> {
  const existing = await db.categories.filter((c) => !c.deleted && c.name === name).first()
  if (existing) {
    if (color && color !== existing.color) {
      await db.categories.put(await stamp({ ...existing, color }))
    }
    return existing
  }
  const cat = await stamp<Category>({
    id: uuid(),
    name,
    color,
    updatedAt: 0,
    lamport: 0,
    modifiedBy: '',
    version: 0,
    deleted: false,
  })
  await db.categories.put(cat)
  notifyChanged()
  return cat
}
