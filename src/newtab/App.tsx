import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useStore } from '../store/useStore'
import * as repo from '../data/repository'
import { sync as runSync, pickSyncDirectory } from '../data/fileSync'
import type { Bookmark, Section as SectionT, UploadedIcon } from '../shared/types'
import { Toolbar } from './components/Toolbar'
import { Section } from './components/Section'
import { BookmarkEditor } from './components/BookmarkEditor'
import { faviconUrl } from '../shared/favicon'

const sectionSortableId = (id: string) => `section:${id}`
const stripSortablePrefix = (id: string, prefix: 'section' | 'bookmark') =>
  id.startsWith(`${prefix}:`) ? id.slice(prefix.length + 1) : id

type PageStyle = CSSProperties & {
  '--bn-panel-opacity': number
  '--bn-overlay': number
}

export default function App() {
  const {
    pages,
    activePageId,
    sections,
    search,
    syncStatus,
    appearance,
    loading,
    init,
    setActivePage,
    setSearch,
    refresh,
    triggerSync,
  } = useStore()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Bookmark | null>(null)
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null)
  const [uploadedIcons, setUploadedIcons] = useState<UploadedIcon[]>([])

  useEffect(() => {
    init()
  }, [init])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections
    const q = search.toLowerCase()
    return sections
      .map((s) => ({
        ...s,
        bookmarks: s.bookmarks.filter(
          (b) =>
            b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.bookmarks.length > 0)
  }, [sections, search])

  const pageStyle = useMemo(() => {
    const style: PageStyle = {
      '--bn-panel-opacity': appearance.panelOpacity,
      '--bn-overlay': appearance.overlay,
    }
    if (appearance.backgroundImage) {
      style.backgroundImage = `url(${appearance.backgroundImage})`
      style.backgroundSize = appearance.backgroundMode === 'repeat' ? 'auto' : appearance.backgroundMode
      style.backgroundRepeat = appearance.backgroundMode === 'repeat' ? 'repeat' : 'no-repeat'
      style.backgroundPosition = 'center'
    }
    return style
  }, [appearance])

  // ---- 书签操作 ----
  const openAdd = (sectionId: string) => {
    setTargetSectionId(sectionId)
    setEditTarget(null)
    void loadUploadedIcons()
    setEditorOpen(true)
  }
  const openEdit = (bm: Bookmark) => {
    setTargetSectionId(bm.sectionId)
    setEditTarget(bm)
    void loadUploadedIcons()
    setEditorOpen(true)
  }
  const loadUploadedIcons = async () => {
    setUploadedIcons(await repo.listUploadedIcons())
  }
  const uploadIcon = async (data: {
    name: string
    dataUrl: string
    mimeType: string
  }) => {
    const icon = await repo.createUploadedIcon(data.name, data.dataUrl, data.mimeType)
    await loadUploadedIcons()
    return icon
  }
  const deleteUploadedIcon = async (id: string) => {
    await repo.deleteUploadedIcon(id)
    await loadUploadedIcons()
  }
  const saveBookmark = async (data: {
    title: string
    url: string
    note?: string
    icon?: string
  }) => {
    if (editTarget) {
      await repo.updateBookmark(editTarget.id, data)
    } else if (targetSectionId) {
      await repo.createBookmark(targetSectionId, {
        ...data,
        icon: data.icon || faviconUrl(data.url),
      })
    }
    setEditorOpen(false)
    if (activePageId) await refresh()
  }
  const deleteBookmark = async (id: string) => {
    await repo.deleteBookmark(id)
    await refresh()
  }

  // ---- 页 / 区域操作 ----
  const addPage = async () => {
    const title = prompt('导航页名称', '新导航页')
    if (!title) return
    const p = await repo.createNavPage(title)
    await refresh()
    await setActivePage(p.id)
  }
  const renamePage = async (id: string) => {
    const cur = pages.find((p) => p.id === id)
    const title = prompt('重命名导航页', cur?.title ?? '')
    if (title && title.trim()) {
      await repo.updateNavPage(id, { title: title.trim() })
      await refresh()
    }
  }
  const deletePage = async (id: string) => {
    if (!confirm('删除当前导航页及其全部内容？')) return
    await repo.deleteNavPage(id)
    await refresh()
  }
  const addSection = async () => {
    if (!activePageId) return
    const title = prompt('区域名称', '新区域')
    if (!title) return
    await repo.createSection(activePageId, title)
    await refresh()
  }
  const renameSection = async (id: string, title: string) => {
    await repo.updateSection(id, { title })
    await refresh()
  }
  const updateSection = async (
    id: string,
    patch: Partial<
      Pick<
        SectionT,
        | 'columns'
        | 'layoutW'
        | 'layoutH'
        | 'bookmarkDisplayMode'
        | 'bookmarkIconSize'
        | 'showBookmarkLabels'
        | 'backgroundColor'
      >
    >,
  ) => {
    await repo.updateSection(id, patch)
    await refresh()
  }
  const deleteSection = async (id: string) => {
    await repo.deleteSection(id)
    await refresh()
  }

  const findSectionByBookmark = (bookmarkId: string) =>
    sections.find((s) => s.bookmarks.some((b) => b.id === bookmarkId))

  // ---- 拖拽：区块排序 + 同区域书签排序 + 跨区域移动 ----
  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('section:')) {
      const activeSectionId = stripSortablePrefix(activeId, 'section')
      const overSection = overId.startsWith('section:')
        ? sections.find((s) => s.id === stripSortablePrefix(overId, 'section'))
        : overId.startsWith('bookmark:')
          ? findSectionByBookmark(stripSortablePrefix(overId, 'bookmark'))
          : sections.find((s) => s.id === overId)
      if (!overSection) return

      const ids = sections.map((s) => s.id)
      const oldIndex = ids.indexOf(activeSectionId)
      const newIndex = ids.indexOf(overSection.id)
      if (oldIndex < 0 || newIndex < 0) return
      const reordered = [...ids]
      reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, activeSectionId)
      await repo.reorder('sections', reordered)
      await refresh()
      return
    }

    const activeBookmarkId = stripSortablePrefix(activeId, 'bookmark')
    const overBookmarkId = stripSortablePrefix(overId, 'bookmark')
    const fromSection = findSectionByBookmark(activeBookmarkId)
    const toSection =
      findSectionByBookmark(overBookmarkId) ??
      sections.find((s) => sectionSortableId(s.id) === overId || s.id === overId)
    if (!fromSection || !toSection) return

    if (fromSection.id === toSection.id) {
      const ids = fromSection.bookmarks.map((b) => b.id)
      const oldIndex = ids.indexOf(activeBookmarkId)
      const newIndex = ids.indexOf(overBookmarkId)
      if (oldIndex < 0 || newIndex < 0) return
      const reordered = [...ids]
      reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, activeBookmarkId)
      await repo.reorder('bookmarks', reordered)
    } else {
      const overIndex = toSection.bookmarks.findIndex((b) => b.id === overBookmarkId)
      const toOrder = overIndex < 0 ? toSection.bookmarks.length : overIndex
      await repo.moveBookmark(activeBookmarkId, toSection.id, toOrder)
      const ids = toSection.bookmarks.map((b) => b.id)
      ids.splice(toOrder, 0, activeBookmarkId)
      await repo.reorder('bookmarks', ids)
    }
    await refresh()
  }

  // ---- 同步 ----
  const onSyncClick = async () => {
    if (syncStatus === 'unconfigured') {
      const handle = await pickSyncDirectory()
      if (handle) {
        await runSync({ requestPermission: true })
        await triggerSync(true)
      }
    } else {
      await triggerSync(true)
    }
  }

  const openOptions = () => chrome.runtime.openOptionsPage()

  if (loading) {
    return (
      <div className="bn-page flex h-screen items-center justify-center text-white/80">
        加载中…
      </div>
    )
  }

  return (
    <div className="bn-page min-h-screen" style={pageStyle}>
      <div className="bn-page-overlay min-h-screen">
        <Toolbar
          pages={pages}
          activePageId={activePageId}
          search={search}
          syncStatus={syncStatus}
          onSelectPage={setActivePage}
          onAddPage={addPage}
          onRenamePage={renamePage}
          onDeletePage={deletePage}
          onSearch={setSearch}
          onAddSection={addSection}
          onSyncClick={onSyncClick}
          onOpenOptions={openOptions}
        />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <main className="px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            {filteredSections.length === 0 ? (
              <div className="mx-auto mt-20 max-w-xl rounded-2xl bg-white/80 p-8 text-center text-muted shadow-sm backdrop-blur">
                {search ? '没有匹配的书签' : '还没有区域，点右上角「+ 区域」开始吧'}
              </div>
            ) : (
              <SortableContext
                items={filteredSections.map((s) => sectionSortableId(s.id))}
                strategy={rectSortingStrategy}
              >
                <div className="bn-board-grid">
                  {filteredSections.map((s) => (
                    <Section
                      key={s.id}
                      section={s}
                      dragDisabled={Boolean(search.trim())}
                      onAddBookmark={openAdd}
                      onEditBookmark={openEdit}
                      onDeleteBookmark={deleteBookmark}
                      onRenameSection={renameSection}
                      onUpdateSection={updateSection}
                      onDeleteSection={deleteSection}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </main>
        </DndContext>

        <BookmarkEditor
          open={editorOpen}
          bookmark={editTarget}
          uploadedIcons={uploadedIcons}
          onClose={() => setEditorOpen(false)}
          onUploadIcon={uploadIcon}
          onDeleteUploadedIcon={deleteUploadedIcon}
          onSave={saveBookmark}
        />
      </div>
    </div>
  )
}
