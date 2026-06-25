import type {
  BookmarkDisplayMode,
  BookmarkIconSize,
  Section,
} from './types'

const DEFAULT_ICON_SIZE: BookmarkIconSize = 'medium'

export interface SectionDisplayConfig {
  bookmarkDisplayMode: BookmarkDisplayMode
  bookmarkIconSize: BookmarkIconSize
  showBookmarkLabels: boolean
  backgroundColor: string
}

export const DEFAULT_SECTION_STYLE: SectionDisplayConfig = {
  bookmarkDisplayMode: 'list',
  bookmarkIconSize: DEFAULT_ICON_SIZE,
  showBookmarkLabels: true,
  backgroundColor: '#fff7cc',
}

export const SECTION_BACKGROUND_PRESETS = [
  { value: '#fff7cc', label: '米黄' },
  { value: '#ffe7e7', label: '浅粉' },
  { value: '#e8f4ff', label: '浅蓝' },
  { value: '#e8f8ef', label: '浅绿' },
  { value: '#f1e9ff', label: '浅紫' },
  { value: '#f4f1ea', label: '暖灰' },
] as const

export const BOOKMARK_ICON_GRID_MIN_WIDTH: Record<BookmarkIconSize, number> = {
  small: 58,
  medium: 76,
  large: 98,
}

export function bookmarkIconGridMinWidth(size?: BookmarkIconSize): number {
  return BOOKMARK_ICON_GRID_MIN_WIDTH[size ?? DEFAULT_ICON_SIZE]
    ?? BOOKMARK_ICON_GRID_MIN_WIDTH[DEFAULT_ICON_SIZE]
}

export const BOOKMARK_LIST_ITEM_HEIGHT: Record<BookmarkIconSize, number> = {
  small: 24,
  medium: 28,
  large: 34,
}

export const BOOKMARK_ICON_TILE_HEIGHT: Record<BookmarkIconSize, number> = {
  small: 58,
  medium: 76,
  large: 94,
}

export interface BookmarkGridMetrics {
  itemHeight: number
  rowGap: number
}

export function bookmarkGridMetrics(
  mode: BookmarkDisplayMode,
  size?: BookmarkIconSize,
): BookmarkGridMetrics {
  const normalizedSize = size ?? DEFAULT_ICON_SIZE
  if (mode === 'icon') {
    return {
      itemHeight:
        BOOKMARK_ICON_TILE_HEIGHT[normalizedSize]
        ?? BOOKMARK_ICON_TILE_HEIGHT[DEFAULT_ICON_SIZE],
      rowGap: 6,
    }
  }

  return {
    itemHeight:
      BOOKMARK_LIST_ITEM_HEIGHT[normalizedSize]
      ?? BOOKMARK_LIST_ITEM_HEIGHT[DEFAULT_ICON_SIZE],
    rowGap: 2,
  }
}

export function sectionDisplayConfig(
  section: Partial<
    Pick<
      Section,
      | 'bookmarkDisplayMode'
      | 'bookmarkIconSize'
      | 'showBookmarkLabels'
      | 'backgroundColor'
    >
  >,
): SectionDisplayConfig {
  return {
    bookmarkDisplayMode: section.bookmarkDisplayMode ?? DEFAULT_SECTION_STYLE.bookmarkDisplayMode,
    bookmarkIconSize: section.bookmarkIconSize ?? DEFAULT_SECTION_STYLE.bookmarkIconSize,
    showBookmarkLabels: section.showBookmarkLabels ?? DEFAULT_SECTION_STYLE.showBookmarkLabels,
    backgroundColor: section.backgroundColor || DEFAULT_SECTION_STYLE.backgroundColor,
  }
}

export function sectionPaperRgb(color: string): string {
  const value = color.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1]
  if (!hex) return sectionPaperRgb(DEFAULT_SECTION_STYLE.backgroundColor)

  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : hex
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

export function sectionPaperBackground(color: string, opacity = 0.96): string {
  return `rgb(${sectionPaperRgb(color)} / ${opacity})`
}
