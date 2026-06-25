import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SECTION_STYLE,
  bookmarkIconGridMinWidth,
  sectionPaperBackground,
  sectionPaperRgb,
  sectionDisplayConfig,
} from '../src/shared/display'
import { DEFAULT_APPEARANCE } from '../src/shared/types'

describe('bookmark display appearance', () => {
  it('keeps bookmark layout out of global appearance settings', () => {
    expect(DEFAULT_APPEARANCE).not.toHaveProperty('bookmarkDisplayMode')
    expect(DEFAULT_APPEARANCE).not.toHaveProperty('bookmarkIconSize')
    expect(DEFAULT_APPEARANCE).not.toHaveProperty('showBookmarkLabels')
  })

  it('defaults each section to list display with a paper background', () => {
    expect(sectionDisplayConfig({})).toEqual(DEFAULT_SECTION_STYLE)
  })

  it('resolves section-level display overrides', () => {
    expect(
      sectionDisplayConfig({
        bookmarkDisplayMode: 'icon',
        bookmarkIconSize: 'small',
        showBookmarkLabels: false,
        backgroundColor: '#e8f4ff',
      }),
    ).toEqual({
      bookmarkDisplayMode: 'icon',
      bookmarkIconSize: 'small',
      showBookmarkLabels: false,
      backgroundColor: '#e8f4ff',
    })
  })

  it('uses denser grids for smaller icon sizes', () => {
    expect(bookmarkIconGridMinWidth('small')).toBeLessThan(
      bookmarkIconGridMinWidth('medium'),
    )
    expect(bookmarkIconGridMinWidth('medium')).toBeLessThan(
      bookmarkIconGridMinWidth('large'),
    )
  })

  it('converts section paper colors to rgb channels', () => {
    expect(sectionPaperRgb('#e8f4ff')).toBe('232 244 255')
    expect(sectionPaperRgb('#fff')).toBe('255 255 255')
  })

  it('formats section paper colors as modern rgb alpha values', () => {
    expect(sectionPaperBackground('#fff7cc')).toBe('rgb(255 247 204 / 0.96)')
  })
})
