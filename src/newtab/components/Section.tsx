import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useState } from 'react'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Bookmark, Section as SectionT } from '../../shared/types'
import { BookmarkCard } from './BookmarkCard'

interface SectionWithBookmarks extends SectionT {
  bookmarks: Bookmark[]
}

interface Props {
  section: SectionWithBookmarks
  dragDisabled?: boolean
  onAddBookmark: (sectionId: string) => void
  onEditBookmark: (bm: Bookmark) => void
  onDeleteBookmark: (id: string) => void
  onRenameSection: (id: string, title: string) => void
  onUpdateSectionLayout: (
    id: string,
    patch: Partial<Pick<SectionT, 'columns' | 'layoutW' | 'layoutH'>>,
  ) => void
  onDeleteSection: (id: string) => void
}

const sectionSortableId = (id: string) => `section:${id}`
const bookmarkSortableId = (id: string) => `bookmark:${id}`
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const spanToWidth = (span?: number) => {
  if (span === 1) return 3
  if (span === 3) return 6
  if (span === 4) return 12
  return 4
}

type SectionStyle = CSSProperties & {
  '--bn-section-w': number
  '--bn-section-h': number
}

function SortableBookmark({
  bm,
  onEdit,
  onDelete,
}: {
  bm: Bookmark
  onEdit: (b: Bookmark) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: bookmarkSortableId(bm.id) })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <BookmarkCard
        bookmark={bm}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export function Section({
  section,
  dragDisabled = false,
  onAddBookmark,
  onEditBookmark,
  onDeleteBookmark,
  onRenameSection,
  onUpdateSectionLayout,
  onDeleteSection,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(section.title)
  const [layoutDraft, setLayoutDraft] = useState(() => ({
    w: clamp(section.layoutW ?? spanToWidth(section.layoutSpan), 3, 12),
    h: clamp(section.layoutH ?? 3, 2, 12),
  }))
  const savedLayoutW = clamp(section.layoutW ?? spanToWidth(section.layoutSpan), 3, 12)
  const savedLayoutH = clamp(section.layoutH ?? 3, 2, 12)
  const layoutW = layoutDraft.w
  const layoutH = layoutDraft.h
  const columns = clamp(Math.floor(layoutW / 3), 1, 4)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionSortableId(section.id), disabled: dragDisabled })

  useEffect(() => {
    setLayoutDraft({ w: savedLayoutW, h: savedLayoutH })
  }, [savedLayoutW, savedLayoutH])

  const sectionStyle: SectionStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
    zIndex: isDragging ? 20 : undefined,
    borderColor: section.color,
    '--bn-section-w': layoutW,
    '--bn-section-h': layoutH,
  }

  const commitTitle = () => {
    setEditing(false)
    const t = titleDraft.trim()
    if (t && t !== section.title) onRenameSection(section.id, t)
    else setTitleDraft(section.title)
  }

  const resizeByPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const startW = layoutW
    const startH = layoutH
    let nextLayout = { w: startW, h: startH }
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      nextLayout = {
        w: clamp(startW + Math.round((moveEvent.clientX - startX) / 120), 3, 12),
        h: clamp(startH + Math.round((moveEvent.clientY - startY) / 56), 2, 12),
      }
      setLayoutDraft(nextLayout)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onUpdateSectionLayout(section.id, {
        layoutW: nextLayout.w,
        layoutH: nextLayout.h,
        columns: clamp(Math.floor(nextLayout.w / 3), 1, 4),
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  return (
    <div
      ref={setNodeRef}
      style={sectionStyle}
      className="bn-section-panel group/section relative flex flex-col overflow-hidden rounded-xl border border-white/55 p-2.5 shadow-sm backdrop-blur-md"
    >
      <div
        className="mb-1.5 flex min-h-[28px] cursor-grab items-center gap-1.5 active:cursor-grabbing"
        title={dragDisabled ? '搜索时暂不支持拖拽区块' : '拖拽标题栏调整区块位置'}
        {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      >
        <span className="rounded px-1.5 py-1 text-xs text-muted hover:bg-black/5 hover:text-ink">
          ⠿
        </span>
        {section.logo && (
          <img src={section.logo} alt="" className="h-4 w-4 rounded" />
        )}
        {editing ? (
          <input
            className="min-w-0 flex-1 rounded border border-accent px-2 py-1 text-sm outline-none"
            value={titleDraft}
            autoFocus
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && commitTitle()}
          />
        ) : (
          <h3
            className="min-w-0 flex-1 cursor-text truncate text-sm font-semibold text-ink"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={() => setEditing(true)}
            title="双击重命名"
          >
            {section.title}
          </h3>
        )}

        <button
          className="rounded px-1.5 py-0.5 text-sm text-muted hover:bg-black/5 hover:text-ink"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onAddBookmark(section.id)}
          title="添加书签"
        >
          +
        </button>
        <button
          className="rounded px-1.5 py-0.5 text-sm text-muted hover:bg-black/5 hover:text-red-500"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (confirm(`删除区域「${section.title}」及其所有书签？`))
              onDeleteSection(section.id)
          }}
          title="删除区域"
        >
          ×
        </button>
      </div>

      <SortableContext
        items={section.bookmarks.map((b) => bookmarkSortableId(b.id))}
        strategy={rectSortingStrategy}
      >
        <div
          className="grid min-h-0 flex-1 content-start gap-x-2 gap-y-0.5 overflow-auto pr-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {section.bookmarks.map((bm) => (
            <SortableBookmark
              key={bm.id}
              bm={bm}
              onEdit={onEditBookmark}
              onDelete={onDeleteBookmark}
            />
          ))}
          {section.bookmarks.length === 0 && (
            <button
              className="col-span-full rounded-lg border border-dashed border-line py-4 text-xs text-muted hover:border-accent hover:text-accent"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onAddBookmark(section.id)}
            >
              + 添加书签
            </button>
          )}
        </div>
      </SortableContext>

      <button
        className="bn-section-resize-handle"
        onPointerDown={resizeByPointer}
        title="拖拽调整区块大小"
        aria-label="拖拽调整区块大小"
      />
    </div>
  )
}
