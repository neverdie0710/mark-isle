export interface SyncFields {
  /** 本地修改的物理时间戳（毫秒）。跨设备冲突的首要判据：谁后改谁赢（LWW）。 */
  updatedAt: number
  /**
   * Lamport 逻辑时钟。每次写入取 max(全局已知最大, 本地计数)+1。
   * 用作 updatedAt 相同 / 时钟回拨时的 tiebreaker，保证多端最终收敛到一致结果。
   */
  lamport: number
  /** 最后修改该记录的设备 id。最终 tiebreaker，保证合并结果确定性。 */
  modifiedBy: string
  /** 本地编辑计数（仅供本机展示/调试，不参与跨设备比较）。 */
  version: number
  /** 软删标记，用于跨设备传播删除。 */
  deleted: boolean
}

export interface NavPage extends SyncFields {
  id: string
  title: string
  icon?: string
  order: number
}

export interface Section extends SyncFields {
  id: string
  pageId: string
  title: string
  logo?: string
  color?: string
  /** 区块内部书签列数，旧数据兼容字段；新版会根据区块宽度自适应。 */
  columns: number
  /** 旧版宽度等级兼容字段。 */
  layoutSpan?: number
  /** Grafana 风格网格宽度，范围 3-12。 */
  layoutW?: number
  /** Grafana 风格网格高度，范围 2-12。 */
  layoutH?: number
  order: number
}

export interface Bookmark extends SyncFields {
  id: string
  sectionId: string
  title: string
  url: string
  icon?: string
  note?: string
  categoryId?: string
  order: number
}

export interface Category extends SyncFields {
  id: string
  name: string
  color?: string
}

export interface LLMConfig {
  enabled: boolean
  endpoint: string
  model: string
  apiKeyCipher?: string
}

export type BackgroundMode = 'cover' | 'contain' | 'repeat'

export interface AppearanceConfig {
  /** 背景图 URL 或本地图片 data URL。为空时使用默认渐变背景。 */
  backgroundImage?: string
  backgroundMode: BackgroundMode
  /** 背景遮罩强度，范围 0-0.7。 */
  overlay: number
  /** 卡片透明度，范围 0.65-1。 */
  panelOpacity: number
}

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  backgroundImage: '',
  backgroundMode: 'cover',
  overlay: 0.18,
  panelOpacity: 0.88,
}

export interface Meta {
  key: string
  deviceId: string
  deviceLabel: string
  lastSyncAt: number
  /** 本机已知的全局最大 Lamport 时钟，写入时自增的依据。 */
  lamportClock: number
  llmConfig: LLMConfig
  appearance: AppearanceConfig
}

export type EntityKind = 'navPages' | 'sections' | 'bookmarks' | 'categories'

export interface DeviceSnapshot {
  deviceId: string
  deviceLabel: string
  exportedAt: number
  navPages: NavPage[]
  sections: Section[]
  bookmarks: Bookmark[]
  categories: Category[]
}

export interface BackupFile extends DeviceSnapshot {
  format: 'mark-isle-backup' | 'bookmark-nav-backup'
  schemaVersion: 1
}
