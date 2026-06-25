import { useState, type SyntheticEvent } from 'react'
import type {
  Bookmark,
  BookmarkDisplayMode,
  BookmarkIconSize,
} from '../../shared/types'
import { faviconUrl, domainOf } from '../../shared/favicon'

interface Props {
  bookmark: Bookmark
  onEdit: (bm: Bookmark) => void
  onDelete: (id: string) => void
  displayMode?: BookmarkDisplayMode
  iconSize?: BookmarkIconSize
  showLabel?: boolean
  dragHandleProps?: Record<string, unknown>
}

const iconImageClass: Record<BookmarkIconSize, string> = {
  small: 'h-8 w-8',
  medium: 'h-10 w-10',
  large: 'h-12 w-12',
}

const iconTileClass: Record<BookmarkIconSize, string> = {
  small: 'min-h-[58px]',
  medium: 'min-h-[76px]',
  large: 'min-h-[94px]',
}

const iconLabelClass: Record<BookmarkIconSize, string> = {
  small: 'text-[10px] leading-[11px]',
  medium: 'text-[11px] leading-3',
  large: 'text-xs leading-[14px]',
}

const listItemClass: Record<BookmarkIconSize, string> = {
  small: 'min-h-[24px] gap-1 px-1.5 py-0.5',
  medium: 'min-h-[28px] gap-1.5 px-1.5 py-1',
  large: 'min-h-[34px] gap-2 px-2 py-1.5',
}

const listIconClass: Record<BookmarkIconSize, string> = {
  small: 'h-3.5 w-3.5',
  medium: 'h-4 w-4',
  large: 'h-5 w-5',
}

const listTextClass: Record<BookmarkIconSize, string> = {
  small: 'text-xs leading-4',
  medium: 'text-[13px] leading-5',
  large: 'text-sm leading-5',
}

export function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  displayMode = 'list',
  iconSize = 'medium',
  showLabel = true,
  dragHandleProps,
}: Props) {
  const [hover, setHover] = useState(false)
  const icon = bookmark.icon || faviconUrl(bookmark.url)
  const domain = domainOf(bookmark.url)
  const label = bookmark.title || domain
  const imageFallback = (e: SyntheticEvent<HTMLImageElement>) => {
    ;(e.target as HTMLImageElement).style.visibility = 'hidden'
  }

  if (displayMode === 'icon') {
    return (
      <div
        className={`group relative flex min-w-0 flex-col items-center justify-start rounded-lg border border-transparent px-1.5 py-1.5 text-center hover:border-line/80 hover:bg-white/80 ${iconTileClass[iconSize]}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        {...dragHandleProps}
      >
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 max-w-full flex-col items-center gap-1 no-underline"
          title={`${label}\n${bookmark.url}`}
          aria-label={label}
        >
          <img
            src={icon}
            alt=""
            className={`${iconImageClass[iconSize]} shrink-0 rounded-lg object-contain`}
            onError={imageFallback}
          />
          {showLabel && (
            <span className={`bn-bookmark-icon-label w-full text-ink ${iconLabelClass[iconSize]}`}>
              {label}
            </span>
          )}
        </a>

        {hover && (
          <div className="absolute right-1 top-1 flex shrink-0 gap-0.5 rounded bg-white/95 shadow-sm">
            <button
              className="rounded px-1 py-0.5 text-[10px] text-muted hover:bg-canvas hover:text-ink"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onEdit(bookmark)}
              title="编辑"
            >
              编辑
            </button>
            <button
              className="rounded px-1 py-0.5 text-[10px] text-muted hover:bg-canvas hover:text-red-500"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onDelete(bookmark.id)}
              title="删除"
            >
              删
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`group relative flex items-center rounded-md border border-transparent hover:border-line/80 hover:bg-white/80 ${listItemClass[iconSize]}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...dragHandleProps}
    >
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-1.5 no-underline"
        title={`${bookmark.title}\n${bookmark.url}`}
      >
        <img
          src={icon}
          alt=""
          className={`${listIconClass[iconSize]} shrink-0 rounded-sm`}
          onError={imageFallback}
        />
        <span className={`min-w-0 flex-1 truncate text-ink ${listTextClass[iconSize]}`}>
          {label}
        </span>
      </a>

      {hover && (
        <div className="flex shrink-0 gap-0.5 rounded bg-white/90 shadow-sm">
          <button
            className="rounded px-1 py-0.5 text-[11px] text-muted hover:bg-canvas hover:text-ink"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(bookmark)}
            title="编辑"
          >
            编辑
          </button>
          <button
            className="rounded px-1 py-0.5 text-[11px] text-muted hover:bg-canvas hover:text-red-500"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(bookmark.id)}
            title="删除"
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}
