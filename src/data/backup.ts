import { db, getMeta } from './db'
import { mergeWithLocal } from './merge'
import type {
  BackupFile,
  NavPage,
  Section,
  Bookmark,
  Category,
  UploadedIcon,
} from '../shared/types'
import { now } from '../shared/id'

const BACKUP_FORMAT = 'mark-isle-backup'
const LEGACY_BACKUP_FORMAT = 'bookmark-nav-backup'

export async function exportBackup(): Promise<BackupFile> {
  const meta = await getMeta()
  const [navPages, sections, bookmarks, categories, uploadedIcons] = await Promise.all([
    db.navPages.toArray(),
    db.sections.toArray(),
    db.bookmarks.toArray(),
    db.categories.toArray(),
    db.uploadedIcons.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    deviceId: meta.deviceId,
    deviceLabel: meta.deviceLabel,
    exportedAt: now(),
    navPages,
    sections,
    bookmarks,
    categories,
    uploadedIcons,
  }
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `mark-isle-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 导入：与本地合并（按 version+updatedAt），不会粗暴覆盖 */
export async function importBackup(json: string): Promise<{ added: number }> {
  const data = JSON.parse(json) as Partial<BackupFile>
  if (data.format !== BACKUP_FORMAT && data.format !== LEGACY_BACKUP_FORMAT) {
    throw new Error('不是有效的签屿备份文件')
  }
  const [navPages, sections, bookmarks, categories, uploadedIcons] = await Promise.all([
    db.navPages.toArray(),
    db.sections.toArray(),
    db.bookmarks.toArray(),
    db.categories.toArray(),
    db.uploadedIcons.toArray(),
  ])

  const np = mergeWithLocal<NavPage>(navPages, [data.navPages ?? []])
  const se = mergeWithLocal<Section>(sections, [data.sections ?? []])
  const bm = mergeWithLocal<Bookmark>(bookmarks, [data.bookmarks ?? []])
  const ca = mergeWithLocal<Category>(categories, [data.categories ?? []])
  const ui = mergeWithLocal<UploadedIcon>(uploadedIcons, [data.uploadedIcons ?? []])

  await db.transaction(
    'rw',
    db.navPages,
    db.sections,
    db.bookmarks,
    db.categories,
    db.uploadedIcons,
    async () => {
      await db.navPages.bulkPut(np.changed)
      await db.sections.bulkPut(se.changed)
      await db.bookmarks.bulkPut(bm.changed)
      await db.categories.bulkPut(ca.changed)
      await db.uploadedIcons.bulkPut(ui.changed)
    },
  )

  return {
    added:
      np.changed.length +
      se.changed.length +
      bm.changed.length +
      ca.changed.length +
      ui.changed.length,
  }
}
