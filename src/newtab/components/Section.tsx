import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useState } from 'react'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DEFAULT_SECTION_STYLE,
  SECTION_BACKGROUND_PRESETS,
  bookmarkGridMetrics,
  bookmarkIconGridMinWidth,
  sectionDisplayConfig,
  sectionPaperBackground,
  sectionPaperRgb,
} from '../../shared/display'
import type {
  Bookmark,
  BookmarkDisplayMode,
  BookmarkIconSize,
  Section as SectionT,
} from '../../shared/types'
import { BookmarkCard } from './BookmarkCard'
import { useI18n } from '../../shared/useI18n'

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
  onUpdateSection: (
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
  '--bn-section-paper-rgb': string
  '--bn-section-paper-bg': string
}

const displayModeOptions: Array<{
  value: BookmarkDisplayMode
  labelKey: 'displayList' | 'displayIcon'
}> = [
  { value: 'list', labelKey: 'displayList' },
  { value: 'icon', labelKey: 'displayIcon' },
]

const iconSizeOptions: Array<{
  value: BookmarkIconSize
  labelKey: 'sizeSmall' | 'sizeMedium' | 'sizeLarge'
}> = [
  { value: 'small', labelKey: 'sizeSmall' },
  { value: 'medium', labelKey: 'sizeMedium' },
  { value: 'large', labelKey: 'sizeLarge' },
]

const GRID_ROW_HEIGHT = 56
const GRID_GAP = 12
const SECTION_CHROME_HEIGHT = 58
const SECTION_STYLE_PANEL_HEIGHT = 128
const EMPTY_SECTION_ROW_HEIGHT = 48

const layoutRowsToHeight = (rows: number) =>
  rows * GRID_ROW_HEIGHT + Math.max(0, rows - 1) * GRID_GAP

const heightToLayoutRows = (height: number) =>
  Math.ceil((height + GRID_GAP) / (GRID_ROW_HEIGHT + GRID_GAP))

function SortableBookmark({
  bm,
  onEdit,
  onDelete,
  bookmarkDisplayMode,
  bookmarkIconSize,
  showBookmarkLabels,
}: {
  bm: Bookmark
  onEdit: (b: Bookmark) => void
  onDelete: (id: string) => void
  bookmarkDisplayMode: BookmarkDisplayMode
  bookmarkIconSize: BookmarkIconSize
  showBookmarkLabels: boolean
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
        displayMode={bookmarkDisplayMode}
        iconSize={bookmarkIconSize}
        showLabel={showBookmarkLabels}
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
  onUpdateSection,
  onDeleteSection,
}: Props) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(section.title)
  const [layoutDraft, setLayoutDraft] = useState(() => ({
    w: clamp(section.layoutW ?? spanToWidth(section.layoutSpan), 3, 12),
    h: clamp(section.layoutH ?? 3, 2, 12),
  }))
  const [styleOpen, setStyleOpen] = useState(false)
  const sectionDisplay = sectionDisplayConfig(section)
  const {
    bookmarkDisplayMode,
    bookmarkIconSize,
    showBookmarkLabels,
    backgroundColor,
  } = sectionDisplay
  const savedLayoutW = clamp(section.layoutW ?? spanToWidth(section.layoutSpan), 3, 12)
  const savedLayoutH = clamp(section.layoutH ?? 3, 2, 12)
  const layoutW = layoutDraft.w
  const columns = clamp(Math.floor(layoutW / 3), 1, 4)
  const isIconMode = bookmarkDisplayMode === 'icon'
  const contentMetrics = bookmarkGridMetrics(bookmarkDisplayMode, bookmarkIconSize)
  const stylePanelHeight = styleOpen ? SECTION_STYLE_PANEL_HEIGHT : 0
  const rowItemHeight =
    section.bookmarks.length === 0
      ? Math.max(contentMetrics.itemHeight, EMPTY_SECTION_ROW_HEIGHT)
      : contentMetrics.itemHeight
  const minLayoutH = clamp(
    heightToLayoutRows(SECTION_CHROME_HEIGHT + stylePanelHeight + rowItemHeight),
    2,
    12,
  )
  const layoutH = Math.max(layoutDraft.h, minLayoutH)
  const contentAvailableHeight = Math.max(
    rowItemHeight,
    layoutRowsToHeight(layoutH) - SECTION_CHROME_HEIGHT - stylePanelHeight,
  )
  const contentStride = rowItemHeight + contentMetrics.rowGap
  const visibleContentRows = Math.max(
    1,
    Math.floor((contentAvailableHeight + contentMetrics.rowGap) / contentStride),
  )
  const bookmarkGridHeight =
    visibleContentRows * rowItemHeight
    + Math.max(0, visibleContentRows - 1) * contentMetrics.rowGap
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionSortableId(section.id), disabled: dragDisabled })

  useEffect(() => {
    setLayoutDraft({ w: savedLayoutW, h: savedLayoutH })
  }, [savedLayoutW, savedLayoutH])

  const sectionStyle: SectionStyle = {
    transform: CSS.Transform.toString(transform) || undefined,
    transition,
    opacity: isDragging ? 0.72 : 1,
    zIndex: isDragging ? 20 : undefined,
    borderColor: section.color,
    '--bn-section-w': layoutW,
    '--bn-section-h': layoutH,
    '--bn-section-paper-rgb': sectionPaperRgb(backgroundColor),
    '--bn-section-paper-bg': sectionPaperBackground(backgroundColor),
  }
  const bookmarkGridStyle: CSSProperties = {
    gridTemplateColumns: isIconMode
      ? `repeat(auto-fill, minmax(${bookmarkIconGridMinWidth(bookmarkIconSize)}px, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`,
    flex: '0 0 auto',
    height: bookmarkGridHeight,
    maxHeight: bookmarkGridHeight,
  }

  const commitTitle = () => {
    setEditing(false)
    const t = titleDraft.trim()
    if (t && t !== section.title) onRenameSection(section.id, t)
    else setTitleDraft(section.title)
  }

  const heightToSnappedRows = (heightPx: number) => {
    const availableHeight = Math.max(
      rowItemHeight,
      heightPx - SECTION_CHROME_HEIGHT - stylePanelHeight,
    )
    const stride = rowItemHeight + contentMetrics.rowGap
    const completeRows = Math.max(1, Math.floor((availableHeight + contentMetrics.rowGap) / stride))
    const snappedHeight =
      SECTION_CHROME_HEIGHT
      + stylePanelHeight
      + completeRows * rowItemHeight
      + Math.max(0, completeRows - 1) * contentMetrics.rowGap

    return clamp(heightToLayoutRows(snappedHeight), minLayoutH, 12)
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
        h: heightToSnappedRows(layoutRowsToHeight(startH) + moveEvent.clientY - startY),
      }
      setLayoutDraft(nextLayout)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onUpdateSection(section.id, {
        layoutW: nextLayout.w,
        layoutH: nextLayout.h,
        columns: clamp(Math.floor(nextLayout.w / 3), 1, 4),
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  const updateSectionStyle = (
    patch: Partial<
      Pick<
        SectionT,
        | 'bookmarkDisplayMode'
        | 'bookmarkIconSize'
        | 'showBookmarkLabels'
        | 'backgroundColor'
      >
    >,
  ) => {
    onUpdateSection(section.id, patch)
  }

  return (
    <div
      ref={setNodeRef}
      style={sectionStyle}
      className="bn-section-panel group/section relative flex flex-col overflow-hidden rounded-xl border p-2.5"
    >
      <div
        className="mb-1.5 flex min-h-[28px] cursor-grab items-center gap-1.5 active:cursor-grabbing"
        title={dragDisabled ? t('dragDisabledSearch') : t('dragSection')}
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
            title={t('doubleClickRename')}
          >
            {section.title}
          </h3>
        )}

        <button
          className="rounded px-1.5 py-0.5 text-sm text-muted hover:bg-black/5 hover:text-ink"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onAddBookmark(section.id)}
          title={t('addBookmark')}
        >
          +
        </button>
        <button
          className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-black/5 hover:text-ink"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setStyleOpen((open) => !open)}
          title={t('sectionStyle')}
          aria-label={t('sectionStyle')}
        >
          {t('style')}
        </button>
        <button
          className="rounded px-1.5 py-0.5 text-sm text-muted hover:bg-black/5 hover:text-red-500"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (confirm(t('confirmDeleteSection', { title: section.title })))
              onDeleteSection(section.id)
          }}
          title={t('delete')}
        >
          ×
        </button>
      </div>

      {styleOpen && (
        <div
          className="mb-2 rounded-xl border border-black/10 bg-white/80 p-2.5 text-xs shadow-sm backdrop-blur"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            {displayModeOptions.map((option) => (
              <button
                key={option.value}
                className={`rounded-lg border px-2 py-1.5 text-left font-medium ${
                  bookmarkDisplayMode === option.value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line bg-white/70 text-ink hover:border-accent/60'
                }`}
                onClick={() =>
                  updateSectionStyle({ bookmarkDisplayMode: option.value })
                }
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <select
              className="rounded-lg border border-line bg-white/80 px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
              value={bookmarkIconSize}
              onChange={(e) =>
                updateSectionStyle({
                  bookmarkIconSize: e.target.value as BookmarkIconSize,
                })
              }
            >
              {iconSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {bookmarkDisplayMode === 'icon' ? t('displayIcon') : t('displayList')}:
                  {' '}
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            {bookmarkDisplayMode === 'icon' && (
              <label className="flex items-center gap-1.5 rounded-lg border border-line bg-white/70 px-2 py-1.5 text-ink">
                <input
                  type="checkbox"
                  className="accent-[#534ab7]"
                  checked={showBookmarkLabels}
                  onChange={(e) =>
                    updateSectionStyle({ showBookmarkLabels: e.target.checked })
                  }
                />
                {t('showLabel')}
              </label>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {SECTION_BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.value}
                className={`h-6 w-6 rounded-full border shadow-sm ${
                  backgroundColor === preset.value
                    ? 'border-accent ring-2 ring-accent/20'
                    : 'border-black/15'
                }`}
                style={{ backgroundColor: preset.value }}
                onClick={() => updateSectionStyle({ backgroundColor: preset.value })}
                title={preset.label}
                aria-label={preset.label}
              />
            ))}
            <label className="ml-auto flex items-center gap-1 rounded-lg border border-line bg-white/70 px-2 py-1 text-muted">
              <span>{t('custom')}</span>
              <input
                type="color"
                className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                value={backgroundColor}
                onChange={(e) => updateSectionStyle({ backgroundColor: e.target.value })}
                title={t('customBackgroundColor')}
              />
            </label>
            <button
              className="rounded-lg bg-canvas px-2 py-1 text-muted hover:bg-line hover:text-ink"
              onClick={() => updateSectionStyle(DEFAULT_SECTION_STYLE)}
            >
              {t('reset')}
            </button>
          </div>
        </div>
      )}

      <SortableContext
        items={section.bookmarks.map((b) => bookmarkSortableId(b.id))}
        strategy={rectSortingStrategy}
      >
        <div
          className={
            isIconMode
              ? 'grid min-h-0 flex-1 auto-rows-min content-start gap-1.5 overflow-auto pr-1'
              : 'grid min-h-0 flex-1 content-start gap-x-2 gap-y-0.5 overflow-auto pr-1'
          }
          style={bookmarkGridStyle}
        >
          {section.bookmarks.map((bm) => (
            <SortableBookmark
              key={bm.id}
              bm={bm}
              onEdit={onEditBookmark}
              onDelete={onDeleteBookmark}
              bookmarkDisplayMode={bookmarkDisplayMode}
              bookmarkIconSize={bookmarkIconSize}
              showBookmarkLabels={showBookmarkLabels}
            />
          ))}
          {section.bookmarks.length === 0 && (
            <button
              className="col-span-full rounded-lg border border-dashed border-line py-4 text-xs text-muted hover:border-accent hover:text-accent"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onAddBookmark(section.id)}
            >
              {t('addBookmarkInline')}
            </button>
          )}
        </div>
      </SortableContext>

      <button
        className="bn-section-resize-handle"
        onPointerDown={resizeByPointer}
        title={t('resizeSection')}
        aria-label={t('resizeSection')}
      />
    </div>
  )
}
