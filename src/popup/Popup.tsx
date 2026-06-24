import { useEffect, useState } from 'react'
import { seedIfEmpty } from '../data/db'
import * as repo from '../data/repository'
import { classifyBookmark } from '../ai/classifier'
import { faviconUrl } from '../shared/favicon'
import type { NavPage, Section } from '../shared/types'

interface Tab {
  title: string
  url: string
  favIconUrl?: string
}

export default function Popup() {
  const [tab, setTab] = useState<Tab | null>(null)
  const [pages, setPages] = useState<NavPage[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [pageId, setPageId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [title, setTitle] = useState('')
  const [saved, setSaved] = useState(false)
  const [aiTag, setAiTag] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      await seedIfEmpty()
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      const t: Tab = {
        title: activeTab?.title ?? '',
        url: activeTab?.url ?? '',
        favIconUrl: activeTab?.favIconUrl,
      }
      setTab(t)
      setTitle(t.title)

      const ps = await repo.listNavPages()
      setPages(ps)
      const firstPage = ps[0]?.id ?? ''
      setPageId(firstPage)
      if (firstPage) {
        const ss = await repo.listSections(firstPage)
        setSections(ss)
        setSectionId(ss[0]?.id ?? '')
      }

      // 后台跑一次 AI/规则分类作为提示
      if (t.url) {
        const cats = (await repo.listCategories()).map((c) => c.name)
        const r = await classifyBookmark({ title: t.title, url: t.url }, cats)
        setAiTag(r.categoryName)
      }
    })()
  }, [])

  const onPageChange = async (pid: string) => {
    setPageId(pid)
    const ss = await repo.listSections(pid)
    setSections(ss)
    setSectionId(ss[0]?.id ?? '')
  }

  const save = async () => {
    if (!tab?.url) return
    let targetSection = sectionId
    if (!targetSection) {
      // 没有区域则在当前页建一个默认区域
      let pid = pageId
      if (!pid) {
        const p = await repo.createNavPage('我的导航')
        pid = p.id
      }
      const s = await repo.createSection(pid, '收藏')
      targetSection = s.id
    }
    const cat = aiTag ? await repo.upsertCategory(aiTag) : undefined
    await repo.createBookmark(targetSection, {
      title: title.trim() || tab.title || tab.url,
      url: tab.url,
      icon: tab.favIconUrl || faviconUrl(tab.url),
      categoryId: cat?.id,
    })
    setSaved(true)
    setTimeout(() => window.close(), 700)
  }

  if (!tab) return <div className="p-4 text-sm text-muted">读取当前页…</div>

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <img
          src={tab.favIconUrl || faviconUrl(tab.url)}
          alt=""
          className="h-5 w-5 rounded"
        />
        <span className="truncate text-xs text-muted">{tab.url}</span>
      </div>

      <input
        className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
      />

      {aiTag && (
        <div className="text-xs text-muted">
          建议分类：<span className="text-accent">{aiTag}</span>
        </div>
      )}

      <div className="flex gap-2">
        <select
          className="flex-1 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-accent"
          value={pageId}
          onChange={(e) => onPageChange(e.target.value)}
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          className="flex-1 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-accent"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          {sections.length === 0 && <option value="">（自动创建区域）</option>}
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <button
        className="w-full rounded-lg bg-accent py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        onClick={save}
        disabled={saved}
      >
        {saved ? '已收藏 ✓' : '收藏到签屿'}
      </button>
    </div>
  )
}
