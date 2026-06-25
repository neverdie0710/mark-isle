import { create } from 'zustand'
import * as repo from '../data/repository'
import { seedIfEmpty, getMeta } from '../data/db'
import { sync, getSyncStatus, type SyncStatus } from '../data/fileSync'
import { DEFAULT_APPEARANCE, type NavPage, type Section, type Bookmark, type AppearanceConfig } from '../shared/types'

interface SectionWithBookmarks extends Section {
  bookmarks: Bookmark[]
}

interface AppState {
  pages: NavPage[]
  activePageId: string | null
  sections: SectionWithBookmarks[]
  search: string
  syncStatus: SyncStatus
  appearance: AppearanceConfig
  loading: boolean

  init: () => Promise<void>
  loadPage: (pageId: string) => Promise<void>
  refresh: () => Promise<void>
  setSearch: (q: string) => void
  setActivePage: (id: string) => Promise<void>
  triggerSync: (requestPermission?: boolean) => Promise<void>
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSync(fn: () => void, ms = 1500) {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(fn, ms)
}

let visibilityBound = false

export const useStore = create<AppState>((set, get) => ({
  pages: [],
  activePageId: null,
  sections: [],
  search: '',
  syncStatus: 'unconfigured',
  appearance: DEFAULT_APPEARANCE,
  loading: true,

  init: async () => {
    await seedIfEmpty()
    // 写操作后自动触发一次防抖同步
    repo.setSyncHook(() => debouncedSync(() => get().triggerSync(false)))

    const [status, meta] = await Promise.all([getSyncStatus(), getMeta()])
    set({ syncStatus: status, appearance: meta.appearance })
    // 启动先拉一次远端（若已授权）
    if (status === 'ok') {
      await sync({ requestPermission: false })
    }

    const pages = await repo.listNavPages()
    const activePageId = pages[0]?.id ?? null
    set({ pages, activePageId, loading: false })
    if (activePageId) await get().loadPage(activePageId)

    // 缓解“某设备从不打开新标签页就同步不到”的问题：
    // 标签页重新可见 / 窗口聚焦 / 定时器，都触发一次后台同步（节流）。
    if (!visibilityBound) {
      visibilityBound = true
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          debouncedSync(() => get().triggerSync(false), 400)
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
      // 长期开着的标签页：每 5 分钟兜底拉一次
      setInterval(() => get().triggerSync(false), 5 * 60 * 1000)
    }
  },

  loadPage: async (pageId) => {
    const sections = await repo.listSections(pageId)
    const withBms: SectionWithBookmarks[] = []
    for (const s of sections) {
      withBms.push({ ...s, bookmarks: await repo.listBookmarks(s.id) })
    }
    set({ sections: withBms })
  },

  refresh: async () => {
    const pages = await repo.listNavPages()
    let activePageId = get().activePageId
    if (!activePageId || !pages.find((p) => p.id === activePageId)) {
      activePageId = pages[0]?.id ?? null
    }
    set({ pages, activePageId })
    if (activePageId) await get().loadPage(activePageId)
  },

  setSearch: (q) => set({ search: q }),

  setActivePage: async (id) => {
    set({ activePageId: id })
    await get().loadPage(id)
  },

  triggerSync: async (requestPermission = false) => {
    const status = await sync({ requestPermission })
    set({ syncStatus: status })
    if (status === 'ok') {
      const meta = await getMeta()
      set({ appearance: meta.appearance })
      await get().refresh()
    }
  },
}))
