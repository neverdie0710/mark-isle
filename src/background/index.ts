/**
 * Service Worker。
 * 注意：MV3 SW 无 DOM、不能持有 File System Access 句柄做后台同步，
 * 因此这里只负责右键菜单 / 快捷键收藏，真正的目录同步在新标签页/设置页触发。
 * 收藏当前页时直接写 IndexedDB（Dexie 在 SW 中可用）。
 */
import { db, seedIfEmpty, nextLamport, currentDeviceId } from '../data/db'
import { uuid, now } from '../shared/id'

const CONTEXT_ID = 'bn-save-current'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_ID,
    title: '收藏此页到签屿',
    contexts: ['page', 'link'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_ID) return
  const url = info.linkUrl || info.pageUrl || tab?.url
  const title = tab?.title || url || ''
  if (url) await quickSave(url, title)
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-current-tab') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.url) await quickSave(tab.url, tab.title || tab.url)
})

/** 收藏到「收件箱」导航页的「最近收藏」区域，离线可用 */
async function quickSave(url: string, title: string) {
  await seedIfEmpty()

  const inboxTitle = '收件箱'
  let page = await db.navPages.filter((p) => !p.deleted && p.title === inboxTitle).first()
  const ts = now()
  const dev = await currentDeviceId()
  if (!page) {
    page = {
      id: uuid(),
      title: inboxTitle,
      order: 999,
      updatedAt: ts,
      lamport: await nextLamport(),
      modifiedBy: dev,
      version: 1,
      deleted: false,
    }
    await db.navPages.put(page)
  }

  let section = await db.sections
    .where('pageId')
    .equals(page.id)
    .filter((s) => !s.deleted)
    .first()
  if (!section) {
    section = {
      id: uuid(),
      pageId: page.id,
      title: '最近收藏',
      columns: 1,
      layoutSpan: 2,
      layoutW: 3,
      layoutH: 3,
      order: 0,
      updatedAt: ts,
      lamport: await nextLamport(),
      modifiedBy: dev,
      version: 1,
      deleted: false,
    }
    await db.sections.put(section)
  }

  const order = await db.bookmarks.where('sectionId').equals(section.id).count()
  await db.bookmarks.put({
    id: uuid(),
    sectionId: section.id,
    title,
    url,
    order,
    updatedAt: now(),
    lamport: await nextLamport(),
    modifiedBy: dev,
    version: 1,
    deleted: false,
  })

  // 角标提示
  chrome.action.setBadgeText({ text: '✓' })
  chrome.action.setBadgeBackgroundColor({ color: '#534ab7' })
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500)
}
