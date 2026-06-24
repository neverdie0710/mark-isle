import { useState } from 'react'
import type { Bookmark } from '../../shared/types'
import { faviconUrl, domainOf } from '../../shared/favicon'

interface Props {
  bookmark: Bookmark
  onEdit: (bm: Bookmark) => void
  onDelete: (id: string) => void
  dragHandleProps?: Record<string, unknown>
}

export function BookmarkCard({ bookmark, onEdit, onDelete, dragHandleProps }: Props) {
  const [hover, setHover] = useState(false)
  const icon = bookmark.icon || faviconUrl(bookmark.url)
  const domain = domainOf(bookmark.url)

  return (
    <div
      className="group relative flex min-h-[28px] items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 hover:border-line/80 hover:bg-white/80"
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
          className="h-4 w-4 shrink-0 rounded-sm"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-ink">
          {bookmark.title || domain}
        </span>
      </a>

      {hover && (
        <div className="flex shrink-0 gap-0.5 rounded bg-white/90 shadow-sm">
          <button
            className="rounded px-1 py-0.5 text-[11px] text-muted hover:bg-canvas hover:text-ink"
            onClick={() => onEdit(bookmark)}
            title="编辑"
          >
            编辑
          </button>
          <button
            className="rounded px-1 py-0.5 text-[11px] text-muted hover:bg-canvas hover:text-red-500"
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
